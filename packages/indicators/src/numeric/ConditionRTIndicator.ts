import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { predicates } from "@qtsurfer/core";

const {
  equal: eq,
  notEqual: ne,
  greaterThan: gt,
  greaterOrEqual: gte,
  lessThan: lt,
  lessOrEqual: lte,
} = predicates;

/**
 * A condition on another indicator, as a number a strategy can read and compose: `1` while the
 * condition holds for the value of the source, `0` while it does not. It is the boolean twin of
 * `PredicateRTIndicator`, which is a filter (it keeps the last value that passed the predicate, so
 * its value is the source's, not a flag).
 *
 * It is ready when the source is, and it resets with it. Before the source is ready the flag still
 * follows the source's partial value, so a rule that must not act on a warm-up reads it with
 * `InstrumentGroupRTIndicator.isValue(name)`, which is `false` until the indicator is ready.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ConditionRTIndicator
 */
export class ConditionRTIndicator extends AbstractDecorableRTIndicator {
  /** Canonical catalog id of every builder form that registers this class. */
  static readonly ID = "condition";

  private readonly condition: (value: number) => boolean;

  constructor(indicator: RTIndicator, condition: (value: number) => boolean) {
    super(indicator);
    this.condition = condition;
  }

  /**
   * Updates the source, then tests the condition against its new value.
   *
   * @returns `1` when the condition holds for the source's new value, `0` when not
   */
  override update(newValue: number): number {
    const value = this.indicator.update(newValue);
    return this.setValue(this.condition(value) ? 1 : 0);
  }

  static equal(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, eq(coefficient));
  }

  static notEqual(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, ne(coefficient));
  }

  static lessThan(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, lt(coefficient));
  }

  static lessOrEqual(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, lte(coefficient));
  }

  static greatThan(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, gt(coefficient));
  }

  static greatOrEqual(indicator: RTIndicator, coefficient: number): ConditionRTIndicator {
    return new ConditionRTIndicator(indicator, gte(coefficient));
  }
}
