import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { predicates } from "@qtsurfer/core";

const { positive: isPositive, negative: isNegative, zero: isZero, greaterThan: gt, greaterOrEqual: gte, lessThan: lt, lessOrEqual: lte } = predicates;

type Predicate = (value: number) => boolean;

/**
 * Replaces the indicator output with a fixed clamp value when a predicate matches. Starts at the
 * decorated indicator's value.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ClampPredicateRTIndicator
 */
export class ClampPredicateRTIndicator extends AbstractDecorableRTIndicator {
  private readonly predicate: Predicate;
  private readonly clampValue: number;

  constructor(indicator: RTIndicator, predicate: Predicate, clampValue: number) {
    super(indicator);
    this.predicate = predicate;
    this.clampValue = clampValue;
    this.setValue(indicator.getValue());
  }

  override reset(): void {
    super.reset();
    this.indicator.reset();
  }

  override update(newValue: number): number {
    const result = this.indicator.update(newValue);
    return this.setValue(this.predicate(result) ? this.clampValue : result);
  }

  static zero(indicator: RTIndicator): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, isZero, 0);
  }

  static positive(indicator: RTIndicator): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, isPositive, 0);
  }

  static negative(indicator: RTIndicator): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, isNegative, 0);
  }

  static positiveOrZero(indicator: RTIndicator): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, (v) => v >= 0, 0);
  }

  static negativeOrZero(indicator: RTIndicator): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, (v) => v <= 0, 0);
  }

  static greaterThan(indicator: RTIndicator, coeff: number): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, gt(coeff), coeff);
  }

  static greaterOrEqual(indicator: RTIndicator, coeff: number): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, gte(coeff), coeff);
  }

  static lessThan(indicator: RTIndicator, coeff: number): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, lt(coeff), coeff);
  }

  static lessOrEqual(indicator: RTIndicator, coeff: number): ClampPredicateRTIndicator {
    return ClampPredicateRTIndicator.clampValue(indicator, lte(coeff), coeff);
  }

  static clampValue(indicator: RTIndicator, predicate: Predicate, clampValue: number): ClampPredicateRTIndicator {
    return new ClampPredicateRTIndicator(indicator, predicate, clampValue);
  }
}
