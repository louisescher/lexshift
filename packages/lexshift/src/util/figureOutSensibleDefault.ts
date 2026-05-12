import type { LexRecordProperty } from "@/types";

/**
 * Tries to figure out a sensible default value based on the property's type.
 *
 * Properties with type boolean, integer, and string keep their `default` declaration as the default.
 * Arrays are instanciated as empty.
 *
 * @param property The property to figure out the default for.
 * @returns The new default value, if any.
 */
export function figureOutSensibleDefault(property: LexRecordProperty): unknown {
	let newDefault: unknown;

	// Booleans, integers and strings can define defaults. Arrays can always be instanciated as empty.
	if (["boolean", "integer", "string"].includes(property.type)) {
		newDefault = (property as { default: unknown }).default;
	} else if (property.type === "array") {
		newDefault = [];
	}

	return newDefault;
}
