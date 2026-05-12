import type { LexResolver } from "@atproto/lex-resolver";
import type { LexiconDoc, LexRecord } from "@atproto/lexicon";

/**
 * An ATproto record containing a `$type` value.
 */
export interface ATProtoRecord extends Record<string, unknown> {
	$type: string;
}

export interface RevisionedATProtoRecord<R extends ATProtoRecord> {
	revision: number;
	record: R;
}

export interface RevisionedATProtoRecordWithHistory<R extends ATProtoRecord>
	extends RevisionedATProtoRecord<R> {
	lexicons: Array<LexiconHistoryCandidate>;
}

export interface ResolvedLexicon {
	revision: number;
	lexicon: LexiconDoc;
	cid: string;
	did: string;
	uri: string;
}

export interface LexiconHistoryCandidate {
	revision?: number;
	lexicon: unknown;
	cid?: string;
}

/**
 * An ATproto record along with its NSID and current lexicon revision. This data
 * should be used to fetch previous lexicons.
 */
export interface IdentifyHistoryProviderInput<R extends ATProtoRecord> {
	nsid: string;
	record: R;
	current: ResolvedLexicon;
}

export type IdentifyHistoryProvider<R extends ATProtoRecord> = (
	input: IdentifyHistoryProviderInput<R>,
) =>
	| Iterable<LexiconHistoryCandidate>
	| AsyncIterable<LexiconHistoryCandidate>
	| Promise<
			Iterable<LexiconHistoryCandidate> | AsyncIterable<LexiconHistoryCandidate>
	  >;

export interface LexshiftOptions<R extends ATProtoRecord> {
	/**
	 * A function that takes in a given input and returns a list of lexicon history candidates.
	 */
	historyProvider?: IdentifyHistoryProvider<R>;
	/**
	 * A function to resolve a lexicon document from the AT protocol network.
	 */
	resolver?: LexResolver;
}

export interface KeyDifferences {
	unchanged: Array<string>;
	converted: Array<[string, LexRecordProperty, LexRecordProperty]>;
	renamed: Array<[string, string]>;
	dropped: Array<string>;
	created: Array<[string, unknown]>;
}

export type LexRecordProperty = LexRecord["record"]["properties"][string];
