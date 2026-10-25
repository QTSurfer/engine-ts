import type { StrategyPropertyType } from "./StrategyPropertyDef";

// What Apache's NumberUtils.isParsable accepts (the same rule validateIR applies to a default):
// an optional '-', then digits with at most one inner '.'. No sign, exponent, hex or padding.
const PARSABLE_NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

const INT_LIMIT = 2 ** 31;
const LONG_LIMIT = 2 ** 63;

/**
 * Value conversion for strategy properties.
 * Port of com.wualabs.qtsurfer.common.util.ConvertHelper, for the types a property can have.
 */
export const ConvertHelper = {
  /**
   * The value as the given type, or `undefined` when it cannot be converted. As in Java:
   *
   * - `int`, `long` and `duration` take a number, which is truncated, or a string that
   *   `isParsable`, whose decimals are truncated too (`"14.7"` is 14). An `int` saturates at the
   *   32-bit limits, a `long` at the 64-bit ones. A `duration` is a length of time in milliseconds.
   * - `double` takes a number as it is, or a string that `isParsable`.
   * - `boolean` never fails: a boolean stays, and anything else is true only when its text is
   *   `true`, whatever the case. `"yes"` and `1` are false.
   * - `String` takes only a string: a number or a boolean has no converter and is refused.
   */
  convert(value: unknown, type: StrategyPropertyType): unknown {
    if (value === null || value === undefined) return undefined;
    switch (type) {
      case "double":
        return toNumber(value);
      case "int":
        return truncate(toNumber(value), INT_LIMIT - 1, -INT_LIMIT);
      case "long":
      case "duration":
        return truncate(toNumber(value), LONG_LIMIT, -LONG_LIMIT);
      case "boolean":
        return typeof value === "boolean" ? value : String(value).toLowerCase() === "true";
      case "String":
        return typeof value === "string" ? value : undefined;
    }
  },

  /** Whether the text is a number the conversions accept: `"14"`, `"-2.5"`, `".5"`; not `"1e3"`. */
  isParsable(text: string): boolean {
    return PARSABLE_NUMBER.test(text);
  },
} as const;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && ConvertHelper.isParsable(value)) return Number(value);
  return undefined;
}

// Java's narrowing: toward zero, saturating at the limits, NaN as 0
function truncate(value: number | undefined, max: number, min: number): number | undefined {
  if (value === undefined) return undefined;
  if (Number.isNaN(value)) return 0;
  const whole = Math.trunc(value);
  return Math.min(Math.max(whole, min), max) + 0;
}
