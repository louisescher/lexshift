import { LexResolver } from "@atproto/lex-resolver";
import {
	BlobRef,
	type LexiconDoc,
	Lexicons,
	parseLexiconDoc,
	ValidationError,
} from "@atproto/lexicon";
import type {
	ATProtoRecord,
	LexiconHistoryCandidate,
	LexshiftOptions,
	ResolvedLexicon,
	RevisionedATProtoRecord,
	RevisionedATProtoRecordWithHistory,
} from "./types";

interface IdentifyOptions<
	R extends ATProtoRecord,
	ReturnLexicons extends boolean = false,
> extends LexshiftOptions<R> {
	/**
	 * Whether the lexicons for the record should be returned as well.
	 */
	returnLexicons?: ReturnLexicons;
}

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
 * @param record The record to get the revision for.
 * @param options Options for resolving the lexicon, including historical data.
 */
export async function identify<R extends ATProtoRecord>(
	record: R,
	options: IdentifyOptions<R, true>,
): Promise<RevisionedATProtoRecordWithHistory<R>>;

export async function identify<R extends ATProtoRecord>(
	record: R,
	options?: IdentifyOptions<R, false>,
): Promise<RevisionedATProtoRecord<R>>;

export async function identify<R extends ATProtoRecord>(
	record: R,
	options: IdentifyOptions<R, boolean> = {},
): Promise<RevisionedATProtoRecord<R> | RevisionedATProtoRecordWithHistory<R>> {
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

	const history = options.historyProvider
		? await Array.fromAsync(
				await options.historyProvider({
					nsid: normalizedNsid,
					record,
					current: resolvedCurrent,
				}),
			)
		: undefined;

	// 4. See if the record matches the lexicon
	//   4.1. If yes, return revision and record
	if (matchesLexicon(record, normalizedNsid, resolvedCurrent.lexicon)) {
		if (options.returnLexicons === true) {
			return {
				revision: resolvedCurrent.revision,
				record,
				lexicons: history ? [...history, asCandidate(currentLexicon)] : [],
			};
		}

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
	if (!history) {
		throw new Error(
			`Record does not match current lexicon ${normalizedNsid} revision ${resolvedCurrent.revision} and no history provider was configured`,
		);
	}

	for (const candidate of history) {
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
			if (options.returnLexicons === true) {
				return {
					revision: candidateRevision,
					record,
					lexicons: history ? [...history, asCandidate(currentLexicon)] : [],
				};
			}

			return { revision: candidateRevision, record };
		}
	}

	// 7. Repeat from 3 until no older revisions remain
	throw new Error(
		`Record does not match any provided lexicon revision for ${normalizedNsid}`,
	);
}

/**
 * Checks if a given record matches a lexicon.
 * @param record The record to check against the lexicon.
 * @param nsid The NSID of the lexicon.
 * @param lexicon The lexicon record.
 * @returns True of the record is valid, false if not.
 */
function matchesLexicon<R extends ATProtoRecord>(
	record: R,
	nsid: string,
	lexicon: LexiconDoc,
): boolean {
	if (!hasAllRequiredFields(record, lexicon)) {
		return false;
	}

	const lexicons = new Lexicons([structuredClone(lexicon)]);
	const candidateRecord = hydrateBlobs(record) as R;

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

/**
 * Checks whether a record contains all fields required by a lexicon.
 * @param record The record to validate.
 * @param lexicon The lexicon to validate the record against.
 * @returns True if the record has all required fields, false if not.
 */
function hasAllRequiredFields(
	record: ATProtoRecord,
	lexicon: LexiconDoc,
): boolean {
	const mainDef = lexicon.defs.main;
	if (!mainDef || mainDef.type !== "record") {
		return false;
	}

	const required = mainDef.record.required ?? [];
	return required.every((key) => Object.hasOwn(record, key));
}

/**
 * Converts the JSON blob values of a record to BlobRefs.
 * @param obj The JSON record
 * @returns The record, with all blob references as classes instead of JSON.
 */
// biome-ignore lint/suspicious/noExplicitAny: Needed
function hydrateBlobs(obj: any): any {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	// Don't process arrays
	if (Array.isArray(obj)) {
		return obj.map(hydrateBlobs);
	}

	if (obj.ref?.$link && typeof obj.mimeType === "string") {
		return new BlobRef(
			obj.ref.$link,
			obj.mimeType,
			obj.size,
			obj.original, // optional, if present
		);
	}

	// Otherwise, recurse through keys
	const entries = Object.entries(obj).map(([key, value]) => [
		key,
		hydrateBlobs(value),
	]);

	return Object.fromEntries(entries);
}

/**
 * Wraps a lexicon to match the `LexiconHistoryCandidate` type.
 * @param currentLexicon The lexicon to wrap.
 * @returns The wrapped lexicon, with a CID of `current`.
 */
function asCandidate(currentLexicon: LexiconDoc): LexiconHistoryCandidate {
	return {
		cid: "current",
		lexicon: currentLexicon,
		revision: currentLexicon.revision,
	};
}
