/**
 * Thrown when a sweep specification fails arithmetic admission: the number
 * of combinations it would expand to ({@link SweepAdmissionException.combos})
 * exceeds the caller's `maxCombos` budget, or the product overflowed.
 *
 * Raised *before* any parameter map is materialized, so a malicious or
 * accidental enormous grid (e.g. `10^12` combos) dies as a multiplication,
 * not an allocation. The combo count is carried on the error so callers can
 * surface it to the user / suggestion engine.
 *
 * Port of the canonical engine's `SweepAdmissionException`.
 */
export class SweepAdmissionException extends Error {
  /**
   * The computed number of combinations, or {@link Number.MAX_SAFE_INTEGER}
   * as a saturating sentinel when the product overflowed and the exact count
   * could not be represented.
   */
  readonly combos: number;

  /** The `maxCombos` budget that was exceeded. */
  readonly maxCombos: number;

  /** True when the combo product overflowed, so `combos` is a sentinel, not an exact count. */
  readonly overflowed: boolean;

  constructor(message: string, combos: number, maxCombos: number, overflowed: boolean) {
    super(message);
    this.name = "SweepAdmissionException";
    this.combos = combos;
    this.maxCombos = maxCombos;
    this.overflowed = overflowed;
  }
}
