import { identify } from "./identify";
import { shiftRecord } from "./shiftRecord";
import type { ATProtoRecord, LexshiftOptions } from "./types";

/**
 * Shifts a record from its current lexicon revision to another one, by either upshifting or downshifting.
 *
 * @param record The record to shift.
 * @param newRevision The revision to shift to.
 * @param options The options for this function.
 */
export async function shift<
	R extends ATProtoRecord,
	N extends number,
	S extends ATProtoRecord,
>(
	record: R,
	newRevision: N,
	options: LexshiftOptions<R> = {},
): Promise<{
	oldRevision: number;
	newRevision: N;
	record: S;
}> {
	const { revision: oldRevision, lexicons } = await identify(record, {
		...options,
		returnLexicons: true,
	});

	// If record already matches revision, return the record
	if (oldRevision === newRevision) {
		return {
			oldRevision,
			newRevision,
			record: record as unknown as S,
		};
	}

	const lowerRevision = newRevision > oldRevision ? oldRevision : newRevision;
	const higherRevision =
		newRevision === lowerRevision ? oldRevision : newRevision;

	const lexiconsInUpgradeOrder = lexicons
		.filter(
			(x) => x.revision! >= lowerRevision && x.revision! <= higherRevision,
		)
		.sort((a, b) => {
			if (newRevision > oldRevision) {
				return (a.revision ?? 0) - (b.revision ?? 0);
			}

			return (b.revision ?? 0) - (a.revision ?? 0);
		});

	return {
		oldRevision,
		newRevision,
		record: shiftRecord<R, S>(record, lexiconsInUpgradeOrder),
	};
}
