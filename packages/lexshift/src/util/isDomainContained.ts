import type { LexRecordProperty } from "../types";
import { isValueAllowedByProperty } from "./isValueAllowedByProperty";

/**
 * Checks whether a list of given values is allowed by both the current and future property.
 * @param fromProperty The current property.
 * @param toProperty The property to convert to.
 * @param domain The values that might be converted.
 * @returns True if the type can be used with the new property, false if not.
 */
export function isTypeDomainContained<T extends string | number | boolean>(
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
	domain: ReadonlyArray<T>,
): boolean {
	for (const sampleValue of domain) {
		if (
			isValueAllowedByProperty(sampleValue, fromProperty) &&
			!isValueAllowedByProperty(sampleValue, toProperty)
		) {
			return false;
		}
	}

	return true;
}

/**
 * Checks whether a string and it's constraints can be accomodated by both the current and future properties.
 * @param fromProperty The current property.
 * @param toProperty The property to convert to.
 * @returns True if the string can be used with the new property, false if not.
 */
export function isStringDomainContained(
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
): boolean {
	const fromString = fromProperty as {
		enum?: Array<string>;
		format?: string;
		minLength?: number;
		maxLength?: number;
	};
	const toStringProperty = toProperty as {
		enum?: Array<string>;
		format?: string;
		minLength?: number;
		maxLength?: number;
	};

	// Enum checks
	if (fromString.enum && toStringProperty.enum) {
		return fromString.enum.every((value) =>
			toStringProperty.enum!.includes(value),
		);
	}
	if (fromString.enum) {
		return fromString.enum.every((value) =>
			isValueAllowedByProperty(value, toProperty),
		);
	}
	if (toStringProperty.enum) {
		return false;
	}

	// Invalid formats or no-format to format conversions
	if (
		fromString.format !== undefined &&
		toStringProperty.format !== undefined &&
		fromString.format !== toStringProperty.format
	) {
		return false;
	}
	if (
		fromString.format === undefined &&
		toStringProperty.format !== undefined
	) {
		return false;
	}

	// Length checks
	if (
		fromString.minLength === undefined &&
		toStringProperty.minLength !== undefined
	) {
		return false;
	}
	if (
		fromString.maxLength === undefined &&
		toStringProperty.maxLength !== undefined
	) {
		return false;
	}

	const oldMin = fromString.minLength ?? 0;
	const oldMax = fromString.maxLength ?? Number.POSITIVE_INFINITY;
	const newMin = toStringProperty.minLength ?? 0;
	const newMax = toStringProperty.maxLength ?? Number.POSITIVE_INFINITY;
	return newMin <= oldMin && oldMax <= newMax;
}

/**
 * Checks whether an integer and it's constraints can be accomodated by both the current and future properties.
 * @param fromProperty The current property.
 * @param toProperty The property to convert to.
 * @returns True if the integer value can be used with the new property, false if not.
 */
export function isIntegerDomainContained(
	fromProperty: LexRecordProperty,
	toProperty: LexRecordProperty,
): boolean {
	const fromInteger = fromProperty as {
		enum?: Array<number>;
		minimum?: number;
		maximum?: number;
	};
	const toInteger = toProperty as {
		enum?: Array<number>;
		minimum?: number;
		maximum?: number;
	};

	// Enum checks
	if (fromInteger.enum && toInteger.enum) {
		return fromInteger.enum.every((value) => toInteger.enum!.includes(value));
	}
	if (fromInteger.enum) {
		return fromInteger.enum.every((value) =>
			isValueAllowedByProperty(value, toProperty),
		);
	}
	if (toInteger.enum) {
		return false;
	}

	// Min/Max constraints
	if (fromInteger.minimum === undefined && toInteger.minimum !== undefined) {
		return false;
	}
	if (fromInteger.maximum === undefined && toInteger.maximum !== undefined) {
		return false;
	}

	const oldMin = fromInteger.minimum ?? Number.NEGATIVE_INFINITY;
	const oldMax = fromInteger.maximum ?? Number.POSITIVE_INFINITY;
	const newMin = toInteger.minimum ?? Number.NEGATIVE_INFINITY;
	const newMax = toInteger.maximum ?? Number.POSITIVE_INFINITY;
	return newMin <= oldMin && oldMax <= newMax;
}
