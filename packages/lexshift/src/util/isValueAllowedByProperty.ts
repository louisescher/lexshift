import type { LexRecordProperty } from "../types";

/**
 * Checks if a value is allowed by a property and its constraints.
 * @param value The value to validate.
 * @param property The property the value should be used with.
 * @returns True if the value is compatible with the property, false if not.
 */
export function isValueAllowedByProperty(
	value: unknown,
	property: LexRecordProperty,
): boolean {
	const constantValue = (property as { const?: unknown }).const;
	if (constantValue !== undefined) {
		return value === constantValue;
	}

	switch (property.type) {
		case "boolean":
			return typeof value === "boolean";
		case "integer": {
			if (typeof value !== "number" || !Number.isInteger(value)) {
				return false;
			}

			const integerProperty = property as {
				minimum?: number;
				maximum?: number;
				enum?: Array<number>;
			};
			if (
				integerProperty.minimum !== undefined &&
				value < integerProperty.minimum
			) {
				return false;
			}
			if (
				integerProperty.maximum !== undefined &&
				value > integerProperty.maximum
			) {
				return false;
			}
			if (integerProperty.enum && !integerProperty.enum.includes(value)) {
				return false;
			}
			return true;
		}
		case "string": {
			if (typeof value !== "string") {
				return false;
			}

			const stringProperty = property as {
				minLength?: number;
				maxLength?: number;
				enum?: Array<string>;
			};
			if (
				stringProperty.minLength !== undefined &&
				value.length < stringProperty.minLength
			) {
				return false;
			}
			if (
				stringProperty.maxLength !== undefined &&
				value.length > stringProperty.maxLength
			) {
				return false;
			}
			if (stringProperty.enum && !stringProperty.enum.includes(value)) {
				return false;
			}
			return true;
		}
		case "array": {
			if (!Array.isArray(value)) {
				return false;
			}

			const arrayProperty = property as {
				minLength?: number;
				maxLength?: number;
			};
			if (
				arrayProperty.minLength !== undefined &&
				value.length < arrayProperty.minLength
			) {
				return false;
			}
			if (
				arrayProperty.maxLength !== undefined &&
				value.length > arrayProperty.maxLength
			) {
				return false;
			}
			return true;
		}
		default:
			return true;
	}
}
