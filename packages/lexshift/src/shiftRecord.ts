import type { LexiconDoc, LexRecord } from "@atproto/lexicon";
import type {
	ATProtoRecord,
	LexiconHistoryCandidate,
	LexRecordProperty,
} from "./types";
import { detectKeyDifferences } from "./util/detectKeyDifferences";
import { figureOutSensibleDefault } from "./util/figureOutSensibleDefault";
import { isValueAllowedByProperty } from "./util/isValueAllowedByProperty";

const CONVERSION_FAILED = Symbol("conversion-failed");

/**
 * Shifts a given record along an upgrade path.
 *
 * @param record The record to shift.
 * @param upgradePath An array of lexicon history candidates in correct order of revisions.
 * @returns The shifted record.
 */
export function shiftRecord<R extends ATProtoRecord, S extends ATProtoRecord>(
	record: R,
	upgradePath: LexiconHistoryCandidate[],
): S {
	const upgradeStepCount = upgradePath.length - 1;

	const recordTemplate = structuredClone(record) as Record<string, unknown>;

	for (let i = 0; i < upgradeStepCount; i++) {
		const currentLexicon = upgradePath[i]!;
		const nextLexicon = upgradePath[i + 1]!;

		const { created, dropped, renamed, converted } = detectKeyDifferences(
			ensureLexRecord(currentLexicon.lexicon),
			ensureLexRecord(nextLexicon.lexicon),
		);

		for (const [key, fromProperty, toProperty] of converted) {
			const convertedValue = tryConvertPropertyValue(
				recordTemplate[key],
				fromProperty,
				toProperty,
			);

			recordTemplate[key] =
				convertedValue === CONVERSION_FAILED
					? figureOutSensibleDefault(toProperty)
					: convertedValue;
		}

		for (const key of dropped) {
			delete recordTemplate[key];
		}

		for (const [oldKey, newKey] of renamed) {
			recordTemplate[newKey] = structuredClone(recordTemplate[oldKey]);
			delete recordTemplate[oldKey];
		}

		for (const [key, defaultVal] of created) {
			recordTemplate[key] = defaultVal;
		}
	}

	return recordTemplate as S;
}

/**
 * Attempts to convert a given value from one property to another.
 * @param value The value to convert.
 * @param fromProperty The property to convert from.
 * @param toProperty The property to convert to.
 * @returns The converted value.
 */
function tryConvertPropertyValue(
	value: unknown,
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
): unknown | typeof CONVERSION_FAILED {
	if (isValueAllowedByProperty(value, toProperty)) {
		return value;
	}

	let convertedValue: unknown = CONVERSION_FAILED;

	if (
		fromProperty.type === "boolean" &&
		toProperty.type === "integer" &&
		typeof value === "boolean"
	) {
		convertedValue = value ? 1 : 0;
	} else if (
		fromProperty.type === "boolean" &&
		toProperty.type === "string" &&
		typeof value === "boolean"
	) {
		convertedValue = value ? "true" : "false";
	} else if (
		fromProperty.type === "integer" &&
		toProperty.type === "boolean" &&
		typeof value === "number"
	) {
		convertedValue = value !== 0;
	} else if (
		fromProperty.type === "integer" &&
		toProperty.type === "string" &&
		typeof value === "number"
	) {
		convertedValue = value.toString();
	} else if (
		fromProperty.type === "string" &&
		toProperty.type === "boolean" &&
		typeof value === "string"
	) {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") {
			convertedValue = true;
		} else if (normalized === "false") {
			convertedValue = false;
		}
	} else if (
		fromProperty.type === "string" &&
		toProperty.type === "integer" &&
		typeof value === "string"
	) {
		const trimmed = value.trim();
		if (/^-?\d+$/.test(trimmed)) {
			convertedValue = Number.parseInt(trimmed, 10);
		}
	}

	if (convertedValue === CONVERSION_FAILED) {
		return CONVERSION_FAILED;
	}

	return isValueAllowedByProperty(convertedValue, toProperty)
		? convertedValue
		: CONVERSION_FAILED;
}

/**
 * Ensures a given lexicon is a record lexicon.
 * @param lexicon The lexicon to check.
 * @returns A typed record lexicon.
 */
function ensureLexRecord(lexicon: unknown): LexRecord {
	const typedLexicon = lexicon as LexiconDoc;

	if (!typedLexicon.defs?.main) {
		throw new Error(
			"Provided lexicon does not have a main definition. Unable to process.",
		);
	}

	if (typedLexicon.defs.main.type !== "record") {
		throw new Error(
			"Provided lexicon's main definition is not a record. Unable to process.",
		);
	}

	return typedLexicon.defs.main;
}
