import { LexResolver } from "@atproto/lex-resolver";
import {
	BlobRef,
	Lexicons,
	ValidationError,
	parseLexiconDoc,
	type LexiconDoc,
} from "@atproto/lexicon";

interface ATProtoRecord extends Record<string, unknown> {
	$type: string;
}

interface RevisionedATProtoRecord<R extends ATProtoRecord> {
	revision: number;
	record: R;
}

interface ResolvedLexicon {
	revision: number;
	lexicon: LexiconDoc;
	cid: string;
	did: string;
	uri: string;
}

interface LexiconHistoryCandidate {
	revision?: number;
	lexicon: unknown;
	cid?: string;
}

interface IdentifyHistoryProviderInput<R extends ATProtoRecord> {
	nsid: string;
	record: R;
	current: ResolvedLexicon;
}

type IdentifyHistoryProvider<R extends ATProtoRecord> = (
	input: IdentifyHistoryProviderInput<R>,
) =>
	| Iterable<LexiconHistoryCandidate>
	| AsyncIterable<LexiconHistoryCandidate>
	| Promise<
			Iterable<LexiconHistoryCandidate> | AsyncIterable<LexiconHistoryCandidate>
	  >;

interface IdentifyOptions<R extends ATProtoRecord> {
	historyProvider?: IdentifyHistoryProvider<R>;
	resolver?: LexResolver;
}

export class Lexshift {
	/**
	 * Identifies the lexicon revision for a given record by analyzing it's keys.
	 *
	 * First, this function attempts to fetch the current lexicon, verifies it, and matches the record against it.
	 * In a case where the record matches, it will return this revision of the lexicon.
	 *
	 * Should the record not match the lexicon and if there is an older revision, that older revision will be retreived.
	 * This happens until the first revision of the lexicon is reached, at which point the record either matches,
	 * or the function throws an error because it does not.
	 *
	 * @param record The record to get the revision for
	 * @param nsid The NSID of the collection this record belongs to
	 */
	public static identify = async <R extends ATProtoRecord>(
		record: R,
		options: IdentifyOptions<R> = {},
	): Promise<RevisionedATProtoRecord<R>> => {
		const normalizedNsid = record.$type.trim();
		if (normalizedNsid.length === 0) {
			throw new Error("NSID is required");
		}

		const resolver = options.resolver ?? new LexResolver({});

		// 1. Resolve the DNS entry for this lexicon NSID to get the DID
		// 2. Get the lexicon from at://{DID}/com.atproto.lexicon.schema/{NSID}
		const currentResult = await resolver.get(normalizedNsid);

		// 3. Verify the lexicon using schema validation via @atproto/lexicon
		const currentLexicon = parseLexiconDoc(
			structuredClone(currentResult.lexicon),
		);
		if (currentLexicon.id !== normalizedNsid) {
			throw new Error(
				`Resolved lexicon id ${currentLexicon.id} does not match requested NSID ${normalizedNsid}`,
			);
		}

		const currentRevision = currentLexicon.revision ?? 1;
		const resolvedCurrent: ResolvedLexicon = {
			revision: currentRevision,
			lexicon: currentLexicon,
			cid: currentResult.cid.toString(),
			did: currentResult.uri.host,
			uri: currentResult.uri.toString(),
		};

		console.log(record);

		// 4. See if the record matches the lexicon
		//   4.1. If yes, return revision and record
		if (matchesLexicon(record, normalizedNsid, resolvedCurrent.lexicon)) {
			return { revision: resolvedCurrent.revision, record };
		}

		// 5. See if this is the first revision
		//   5.1. If yes, throw error
		if (resolvedCurrent.revision <= 1) {
			throw new Error(
				`Record does not match lexicon ${normalizedNsid} at first revision`,
			);
		}

		// 6. Fetch an earlier revision via pluggable history provider
		if (!options.historyProvider) {
			throw new Error(
				`Record does not match current lexicon ${normalizedNsid} revision ${resolvedCurrent.revision} and no history provider was configured`,
			);
		}

		const history = await options.historyProvider({
			nsid: normalizedNsid,
			record,
			current: resolvedCurrent,
		});

		for await (const candidate of toAsyncIterable(history)) {
			const historicalLexicon = parseLexiconDoc(
				structuredClone(candidate.lexicon),
			);
			if (historicalLexicon.id !== normalizedNsid) {
				continue;
			}

			const candidateRevision =
				candidate.revision ?? historicalLexicon.revision ?? 1;
			if (candidateRevision >= resolvedCurrent.revision) {
				continue;
			}

			if (matchesLexicon(record, normalizedNsid, historicalLexicon)) {
				return { revision: candidateRevision, record };
			}
		}

		// 7. Repeat from 3 until no older revisions remain
		throw new Error(
			`Record does not match any provided lexicon revision for ${normalizedNsid}`,
		);
	};

	/**
	 *
	 * @param lexicon
	 * @param record
	 */
	public static convert = <R extends ATProtoRecord>(
		_lexicon: unknown,
		record: R,
	) => record;
}

function toAsyncIterable<T>(
	value: Iterable<T> | AsyncIterable<T>,
): AsyncIterable<T> {
	if (Symbol.asyncIterator in value) {
		return value as AsyncIterable<T>;
	}

	return (async function* fromIterable() {
		yield* value as Iterable<T>;
	})();
}

function matchesLexicon<R extends ATProtoRecord>(
	record: R,
	nsid: string,
	lexicon: LexiconDoc,
): boolean {
	const lexicons = new Lexicons([structuredClone(lexicon)]);
	const typedRecord = withRecordType(record, nsid);
	const candidateRecord = hydrateBlobs(typedRecord) as typeof typedRecord;

	try {
		lexicons.assertValidRecord(nsid, candidateRecord);
		return true;
	} catch (error) {
		if (error instanceof ValidationError) {
			return false;
		}

		throw error;
	}
}

function withRecordType<R extends ATProtoRecord>(
	record: R,
	nsid: string,
): R & { $type: string } {
	const currentType = record.$type;
	if (typeof currentType === "string") {
		return record as R & { $type: string };
	}

	return {
		...record,
		$type: nsid,
	};
}

function hydrateBlobs(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Don't process arrays
	if (Array.isArray(obj)) {
		return obj.map(hydrateBlobs);
	}

	if (obj.ref && obj.ref['$link'] && typeof obj.mimeType === 'string') {
    return new BlobRef(
      obj.ref['$link'],
      obj.mimeType,
      obj.size,
      obj.original // optional, if present
    );
  }

  // Otherwise, recurse through keys
  const entries = Object.entries(obj).map(([key, value]) => [
    key,
    hydrateBlobs(value),
  ]);

  return Object.fromEntries(entries);
}
