import type { LexRecord } from "@atproto/lexicon";
import type { KeyDifferences, LexRecordProperty } from "../types";
import { figureOutSensibleDefault } from "./figureOutSensibleDefault";
import {
	isIntegerDomainContained,
	isStringDomainContained,
	isTypeDomainContained,
} from "./isDomainContained";

/**
 * Attempts to detect which keys differ between two lexicons, and in which way.
 *
 * Keys will be separated into one of five categories:
 *
 * - unchanged
 * - converted
 * - renamed
 * - dropped
 * - created
 *
 * @param lex1 The previous lexicon that the conversion is attempted from.
 * @param lex2 The lexicon the data should be converted to.
 * @returns The differences between the lexicons.
 */
export function detectKeyDifferences(
	lex1: LexRecord,
	lex2: LexRecord,
): KeyDifferences {
	const processedFromLex1: Array<string> = [];
	const processedFromLex2: Array<string> = [];
	const unchanged: Array<string> = [];
	const converted: Array<[string, LexRecordProperty, LexRecordProperty]> = [];
	const renamed: Array<[string, string]> = [];
	const dropped: Array<string> = [];
	const created: Array<[string, unknown]> = [];

	const lex1Properties = Object.keys(lex1.record.properties);
	const lex2Properties = Object.keys(lex2.record.properties);

	// Process keys with the same name first. Cases: unchanged / type change
	for (const key of lex1Properties) {
		const sameKeyName = lex2Properties.find((x) => x === key);

		if (sameKeyName) {
			processedFromLex1.push(sameKeyName);
			processedFromLex2.push(sameKeyName);

			const oldProperty = lex1.record.properties[key]!;
			const newProperty = lex2.record.properties[sameKeyName]!;

			if (canKeepExistingValue(oldProperty, newProperty)) {
				unchanged.push(key);
				continue;
			}

			if (canAttemptConversion(oldProperty, newProperty)) {
				converted.push([key, oldProperty, newProperty]);
				continue;
			}

			dropped.push(key);
			created.push([key, figureOutSensibleDefault(newProperty)]);
		}
	}

	const lex1Entries = Object.entries(lex1.record.properties);
	const lex2Entries = Object.entries(lex2.record.properties);
	const unprocessedLex1Keys = lex1Entries.filter(
		([x]) => !processedFromLex1.some((y) => y === x),
	);

	// Check if there is a new key (not present in lex 1) with the same type.
	for (const [lex1key, lex1val] of unprocessedLex1Keys) {
		// Since the processed keys update after each lex1 key, we need to make sure this stays up-to-date,
		// even if it's not performant. There's probably a more performant version of this but I can't be bothered
		// to figure it out rn
		const unprocessedLex2Keys = lex2Entries.filter(
			([x]) => !processedFromLex2.some((y) => y === x),
		);

		for (const [lex2key, lex2val] of unprocessedLex2Keys) {
			const signaturesMatch =
				getPropertySignature(lex1val) === getPropertySignature(lex2val);

			if (!signaturesMatch) {
				continue;
			}

			const inverseMatches = unprocessedLex1Keys.filter(
				([, maybeSame]) =>
					getPropertySignature(maybeSame) === getPropertySignature(lex2val),
			);

			if (inverseMatches.length === 1) {
				renamed.push([lex1key, lex2key]);
				processedFromLex1.push(lex1key);
				processedFromLex2.push(lex2key);
				break;
			}
		}
	}

	const remainingLex1Keys = lex1Properties.filter(
		(x) => !processedFromLex1.some((y) => y === x),
	);
	const remainingLex2Keys = lex2Properties.filter(
		(x) => !processedFromLex2.some((y) => y === x),
	);

	// If there are keys left from the old lexicons, drop
	for (const key of remainingLex1Keys) {
		dropped.push(key);
	}

	// If there are keys left from the new lexicons, create
	for (const key of remainingLex2Keys) {
		created.push([key, figureOutSensibleDefault(lex2.record.properties[key]!)]);
	}

	return {
		unchanged,
		converted,
		renamed,
		dropped,
		created,
	};
}

/**
 * Checks whether a given property can reasonably be converted to another type.
 *
 * The following conversions are considered sensible:
 *
 * - boolean → integer
 * - boolean → string
 * - integer → boolean
 * - integer → string
 * - string → boolean
 * - string → integer
 *
 * @param fromProperty The property to be converted from.
 * @param toProperty The property to be converted to.
 * @returns Whether the conversion can be done.
 */
function canAttemptConversion(
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
): boolean {
	if (fromProperty.type === toProperty.type) {
		return false;
	}

	return (
		(fromProperty.type === "boolean" && toProperty.type === "integer") ||
		(fromProperty.type === "boolean" && toProperty.type === "string") ||
		(fromProperty.type === "integer" && toProperty.type === "boolean") ||
		(fromProperty.type === "integer" && toProperty.type === "string") ||
		(fromProperty.type === "string" && toProperty.type === "boolean") ||
		(fromProperty.type === "string" && toProperty.type === "integer")
	);
}

/**
 * Detects whether the value of a given property can be kept when converting to a different type.
 * @param fromProperty The property that will be converted from.
 * @param toProperty The property that will be converted to.
 * @returns Whether the conversion can be done while preserving the value.
 */
export function canKeepExistingValue(
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
): boolean {
	if (fromProperty.type !== toProperty.type) {
		return false;
	}

	if (getPropertySignature(fromProperty) === getPropertySignature(toProperty)) {
		return true;
	}

	switch (fromProperty.type) {
		case "boolean":
			return isTypeDomainContained(fromProperty, toProperty, [false, true]);
		case "integer":
			return isIntegerDomainContained(fromProperty, toProperty);
		case "string":
			return isStringDomainContained(fromProperty, toProperty);
		case "array": {
			const fromArray = fromProperty as {
				minLength?: number;
				maxLength?: number;
			};
			const toArray = toProperty as { minLength?: number; maxLength?: number };
			const oldMin = fromArray.minLength ?? 0;
			const oldMax = fromArray.maxLength;
			const newMin = toArray.minLength ?? 0;
			const newMax = toArray.maxLength;
			return (
				newMin <= oldMin &&
				(newMax === undefined || (oldMax !== undefined && oldMax <= newMax))
			);
		}
		default:
			return false;
	}
}

/**
 * Returns the stringified version of a normalized property.
 * @param property The property to get the signature for.
 * @returns The signature of the property.
 */
function getPropertySignature(property: LexRecordProperty): string {
	return JSON.stringify(normalizeForComparison(property));
}

/**
 * Normalizes a given value so it can be compared to another.
 * @param value The value to normalize.
 * @returns The normalized value.
 */
function normalizeForComparison(value: unknown): unknown {
	if (Array.isArray(value)) {
		const normalizedArray = value.map((item) => normalizeForComparison(item));
		if (
			normalizedArray.every((item) =>
				["string", "number", "boolean"].includes(typeof item),
			)
		) {
			return [...normalizedArray].sort((a, b) =>
				String(a).localeCompare(String(b)),
			);
		}
		return normalizedArray;
	}

	if (value && typeof value === "object") {
		const normalizedEntries = Object.entries(value as Record<string, unknown>)
			.filter(([key]) => key !== "description")
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entryValue]) => [key, normalizeForComparison(entryValue)]);
		return Object.fromEntries(normalizedEntries);
	}

	return value;
}
