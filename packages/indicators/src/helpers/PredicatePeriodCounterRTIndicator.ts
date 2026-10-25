import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { predicates } from "@qtsurfer/core";

const {
  positive: isPositive,
  negative: isNegative,
  equal: eq,
  notEqual: ne,
  greaterThan: gt,
  greaterOrEqual: gte,
  lessThan: lt,
  lessOrEqual: lte,
} = predicates;

/**
 * Counts consecutive periods where a predicate holds true on an indicator's output. Its value is the
 * decorated indicator's value, whether or not the predicate holds; the count is `periodCount`.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.PredicatePeriodCounterRTIndicator
 */
export class PredicatePeriodCounterRTIndicator extends AbstractDecorableRTIndicator {
  private readonly predicate: (value: number) => boolean;
  private _periodCount = 0;
  private _maxPeriods = 0;
  private _maxPeriodsValue = 0;
  private _periodStartValue = 0;

  constructor(indicator: RTIndicator, predicate: (value: number) => boolean) {
    super(indicator);
    this.predicate = predicate;
    this.setValue(indicator.getValue());
  }

  get periodCount(): number {
    return this._periodCount;
  }

  /** Same as `periodCount`. */
  get currentPeriods(): number {
    return this._periodCount;
  }

  resetPeriods(): void {
    this._periodCount = 0;
  }

  get maxPeriods(): number {
    return this._maxPeriods;
  }

  get maxPeriodsValue(): number {
    return this._maxPeriodsValue;
  }

  get periodStartValue(): number {
    return this._periodStartValue;
  }

  override update(newValue: number): number {
    const indicatorValue = this.indicator.update(newValue);
    if (this.predicate(indicatorValue)) {
      if (this._periodCount === 0) {
        this._periodStartValue = indicatorValue;
      }
      this._periodCount++;
      if (this._periodCount >= this._maxPeriods) {
        this._maxPeriods = this._periodCount;
        this._maxPeriodsValue = indicatorValue;
      }
    } else {
      this._periodCount = 0;
    }
    return this.setValue(indicatorValue);
  }

  override reset(): void {
    super.reset();
    this.indicator.reset();
    this._periodCount = 0;
    this._maxPeriods = 0;
    this._maxPeriodsValue = 0;
    this._periodStartValue = 0;
  }

  static positive(indicator: RTIndicator): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, isPositive);
  }

  static negative(indicator: RTIndicator): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, isNegative);
  }

  static positiveOrZero(
    indicator: RTIndicator,
  ): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, (v) => v >= 0);
  }

  static negativeOrZero(
    indicator: RTIndicator,
  ): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, (v) => v <= 0);
  }

  static equal(indicator: RTIndicator, coefficient: number): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, eq(coefficient));
  }

  static notEqual(indicator: RTIndicator, coefficient: number): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, ne(coefficient));
  }

  static greatThan(indicator: RTIndicator, coefficient: number): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, gt(coefficient));
  }

  static greatOrEqual(indicator: RTIndicator, coefficient: number): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, gte(coefficient));
  }

  static lessOrEqual(indicator: RTIndicator, coefficient: number): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, lte(coefficient));
  }

  /** Same as `greatThan`. */
  static greaterThan(
    indicator: RTIndicator,
    coeff: number,
  ): PredicatePeriodCounterRTIndicator {
    return PredicatePeriodCounterRTIndicator.greatThan(indicator, coeff);
  }

  static lessThan(
    indicator: RTIndicator,
    coeff: number,
  ): PredicatePeriodCounterRTIndicator {
    return new PredicatePeriodCounterRTIndicator(indicator, lt(coeff));
  }
}
