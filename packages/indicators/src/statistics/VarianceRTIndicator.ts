import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

/**
 * How a `VarianceRTIndicator` (and so the standard deviation and the Bollinger bands) works the
 * variance out. Both give the variance of the window; they differ in cost and in the last digits.
 *
 * - `"exact"` (the default): the mean first, then the squared deviations from it, from the window on
 *   every tick. O(periods) per tick, exact to the last digits, nothing to drift, the same digits in
 *   every engine.
 * - `"fast"`: O(1) per tick. Running sums of the deviations from a reference value near the mean of the
 *   window, with a bound on the rounding they have gathered; the window is worked out again (an exact
 *   pass, rare in practice) as soon as that bound could cost more than one part in a thousand million
 *   of the variance. The bound is a worst case (the tests hold the result to ten times that of the exact
 *   one) and it does not lose the width of the bands in a quiet market the way a plain running sum of
 *   squares does, but it is not bit-for-bit the exact result.
 */
export type VariancePrecision = "exact" | "fast";

/** Smallest relative size of the rounding of the running sums that "fast" lets pass: one part in 1e9. */
const FAST_TOLERANCE = 1e-9;

/** 2^-53, the rounding of one floating-point operation relative to its result. */
const UNIT_ROUNDOFF = 1.1102230246251565e-16;

/**
 * Variance RTIndicator.
 * In periodic mode, by default (`"exact"`), computes the variance of the window on every tick from the
 * window itself, the mean first and then the squared deviations from it: O(periods) per tick, exact to
 * the last digits and with nothing to drift. The running sum of squares it replaces
 * (Var(X) = E(X²) - E(X)²) cancels the deviation away when the mean is large next to it, as in a quiet
 * window of prices in the tens of thousands, and the rounding it picks up with each update never goes
 * away. `withPrecision("fast")` trades the last digits for O(1) per tick (see `VariancePrecision`).
 * Port of com.wualabs.qtsurfer.engine.indicators.statistics.VarianceRTIndicator
 */
export class VarianceRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly _sma: SmaRTIndicator;
  /** The last `periods` values, a ring: `head` is where the next one goes and, once it is full, where the oldest is. */
  private readonly values: Float64Array;
  private head = 0;
  private count = 0;
  private averageSample = true;
  private _precision: VariancePrecision = "exact";

  // "fast": sums of the deviations from `shift` (the mean of the window when they were last worked out
  // from it), and an upper bound of the rounding each of the two sums has gathered since
  private shift = 0;
  private sumShifted = 0;
  private sumShiftedSquares = 0;
  private sumBound = 0;
  private squaresBound = 0;
  private fastStarted = false;
  private _fastRecalculations = 0;

  constructor();
  constructor(periods: number);
  constructor(indicator: RTIndicator);
  constructor(indicator: RTIndicator | null, periods: number);
  constructor(indicatorOrPeriods?: RTIndicator | number | null, periods?: number) {
    let ind: RTIndicator | null = null;
    let p = 0;
    if (typeof indicatorOrPeriods === "number") {
      p = indicatorOrPeriods;
    } else if (indicatorOrPeriods != null) {
      ind = indicatorOrPeriods;
      p = periods ?? 0;
    } else if (periods != null) {
      p = periods;
    }
    super(p, ind);
    this._sma = new SmaRTIndicator(p).withDiscreteMode(false);
    this.values = new Float64Array(Math.max(p, 1));
  }

  get sma(): SmaRTIndicator {
    return this._sma;
  }

  override reset(): void {
    super.reset();
    this._sma.reset();
    this.head = 0;
    this.count = 0;
    this.fastStarted = false;
    this._fastRecalculations = 0;
  }

  withAverageSample(averageSample: boolean): this {
    this.averageSample = averageSample;
    return this;
  }

  /**
   * Chooses how the variance is worked out: `"exact"` (the default) from the window on every tick, or
   * `"fast"`, O(1) running sums with a guard. Safe to change at any point: "fast" starts from the values
   * the window holds at that moment.
   */
  withPrecision(precision: VariancePrecision): this {
    this._precision = precision;
    this.fastStarted = false;
    return this;
  }

  get precision(): VariancePrecision {
    return this._precision;
  }

  /** How many times "fast" worked the window out again from the window itself (for tests and diagnostics). */
  get fastRecalculations(): number {
    return this._fastRecalculations;
  }

  protected override tickValue(
    _tick: number,
    _init: boolean,
    endPeriod: boolean,
    newValue: number,
  ): number {
    this._sma.update(newValue);
    const values = this.values;
    const capacity = values.length;
    const fast = this._precision === "fast";
    if (fast && this.fastStarted) {
      if (this.count === capacity) {
        this.slide(values[this.head]);
      }
      this.add(newValue);
    }
    values[this.head] = newValue;
    this.head = this.head + 1 === capacity ? 0 : this.head + 1;
    if (this.count < capacity) {
      this.count++;
    }
    if (fast && !this.fastStarted) {
      this.workSumsOutFromWindow();
      this.fastStarted = true;
    }
    if (this.periodCycles > 0 || endPeriod) {
      const n = this.count;
      let variance: number;
      if (fast) {
        let m2 = this.sumShiftedSquares - (this.sumShifted * this.sumShifted) / n;
        // NaN, a negative variance and a rounding bound that could cost more than the tolerance all land here
        if (!(m2 >= 0) || this.roundingOf(m2, n) > FAST_TOLERANCE * m2) {
          this.workSumsOutFromWindow();
          this._fastRecalculations++;
          m2 = this.sumShiftedSquares - (this.sumShifted * this.sumShifted) / n;
          if (!(m2 >= 0)) {
            m2 = 0;
          }
        }
        variance = m2 / n;
      } else {
        variance = this.exactVariance(n);
      }
      return this.averageSample ? (variance * n) / (n - 1) : variance;
    }
    return 0;
  }

  /** "fast": the oldest value leaves the sums. */
  private slide(oldest: number): void {
    const y = oldest - this.shift;
    const squared = y * y;
    this.sumShifted -= y;
    this.sumShiftedSquares -= squared;
    this.gatherRounding(y, squared);
  }

  /** "fast": a value joins the sums. */
  private add(value: number): void {
    const y = value - this.shift;
    const squared = y * y;
    this.sumShifted += y;
    this.sumShiftedSquares += squared;
    this.gatherRounding(y, squared);
  }

  /**
   * "fast": the rounding one add or one eviction can have left in each sum. The subtraction that gives `y` and
   * the product that gives `y²` round too (one part in 2^53 each, so `y²` carries three), and then the sum
   * itself rounds.
   */
  private gatherRounding(y: number, squared: number): void {
    this.sumBound += UNIT_ROUNDOFF * (Math.abs(this.sumShifted) + Math.abs(y));
    this.squaresBound += UNIT_ROUNDOFF * (Math.abs(this.sumShiftedSquares) + 3 * squared);
  }

  /**
   * "fast": an upper bound of the rounding in `Σ(x-shift)² - (Σ(x-shift))² / n`: the rounding of the squares,
   * the rounding of the plain sum seen through its square, and the rounding of the subtraction and the
   * division themselves.
   */
  private roundingOf(m2: number, n: number): number {
    return (
      this.squaresBound +
      (2 * Math.abs(this.sumShifted) * this.sumBound + this.sumBound * this.sumBound) / n +
      UNIT_ROUNDOFF *
        (Math.abs(this.sumShiftedSquares) + (this.sumShifted * this.sumShifted) / n + Math.abs(m2))
    );
  }

  /** "fast": new reference value (the mean of the window) and the sums of the deviations from it, from the window itself. */
  private workSumsOutFromWindow(): void {
    const values = this.values;
    const capacity = values.length;
    const n = this.count;
    const start = n < capacity ? 0 : this.head;
    let sum = 0;
    for (let i = 0, j = start; i < n; i++) {
      sum += values[j];
      j = j + 1 === capacity ? 0 : j + 1;
    }
    const mean = sum / n;
    let deviations = 0;
    let squares = 0;
    for (let i = 0, j = start; i < n; i++) {
      const deviation = values[j] - mean;
      deviations += deviation;
      squares += deviation * deviation;
      j = j + 1 === capacity ? 0 : j + 1;
    }
    this.shift = mean;
    this.sumShifted = deviations;
    this.sumShiftedSquares = squares;
    this.sumBound = UNIT_ROUNDOFF * n * Math.max(Math.abs(deviations), Math.sqrt(squares * n));
    this.squaresBound = UNIT_ROUNDOFF * n * squares * 3;
  }

  /** "exact": the population variance of the window, oldest value first, as the values arrived. */
  private exactVariance(n: number): number {
    const values = this.values;
    const capacity = values.length;
    const start = n < capacity ? 0 : this.head;
    let sum = 0;
    for (let i = 0, j = start; i < n; i++) {
      sum += values[j];
      j = j + 1 === capacity ? 0 : j + 1;
    }
    const mean = sum / n;
    let squares = 0;
    for (let i = 0, j = start; i < n; i++) {
      const deviation = values[j] - mean;
      squares += deviation * deviation;
      j = j + 1 === capacity ? 0 : j + 1;
    }
    return squares / n;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    prevValue += this.calculate(newValue);
    return (prevValue /= 2);
  }

  private calculate(newValue: number): number {
    const median = this._sma.update(newValue);
    const diff = newValue - median;
    return diff * diff;
  }
}
