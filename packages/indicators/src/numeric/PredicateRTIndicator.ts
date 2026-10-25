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
 * Filters indicator output through a predicate: the value is accepted while the predicate holds,
 * and the last accepted value is kept while it does not. Starts at the decorated indicator's value.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.PredicateRTIndicator
 */
export class PredicateRTIndicator extends AbstractDecorableRTIndicator {
  private readonly predicate: (value: number) => boolean;

  constructor(indicator: RTIndicator, predicate: (value: number) => boolean) {
    super(indicator);
    this.predicate = predicate;
    this.setValue(indicator.getValue());
  }

  override reset(): void {
    super.reset();
    this.indicator.reset();
  }

  override update(newValue: number): number {
    const result = this.indicator.update(newValue);
    return this.predicate(result) ? this.setValue(result) : this.getValue();
  }

  static positive(indicator: RTIndicator): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, isPositive);
  }

  static negative(indicator: RTIndicator): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, isNegative);
  }

  static positiveOrZero(indicator: RTIndicator): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, (v) => v >= 0);
  }

  static negativeOrZero(indicator: RTIndicator): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, (v) => v <= 0);
  }

  static equal(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, eq(coefficient));
  }

  static notEqual(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, ne(coefficient));
  }

  static greatThan(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, gt(coefficient));
  }

  static greatOrEqual(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, gte(coefficient));
  }

  static lessThan(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, lt(coefficient));
  }

  static lessOrEqual(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return new PredicateRTIndicator(indicator, lte(coefficient));
  }

  /** Same as `greatThan`. */
  static greaterThan(indicator: RTIndicator, coefficient: number): PredicateRTIndicator {
    return PredicateRTIndicator.greatThan(indicator, coefficient);
  }
}
