import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { predicates } from "@qtsurfer/core";
import { TransformRTIndicator } from "./TransformRTIndicator";
import { ValueRTIndicator } from "./ValueRTIndicator";

const { positive: isPositive, negative: isNegative, zero: isZero, greaterThan: gt, lessThan: lt } = predicates;

type Predicate = (value: number) => boolean;
type UnaryOperator = (value: number) => number;

/** A conditional described by values: what `when` and its `then`, `orElse` and `defaultValue` build. */
interface ValueForm {
  readonly predicate: Predicate;
  readonly defaultValue: number;
  readonly thenOperator: UnaryOperator | null;
  readonly elseOperator: UnaryOperator | null;
}

/**
 * Updates the decorated indicator, then feeds its value to the `then` indicator when the predicate
 * holds for the decorated indicator, or to the `else` indicator when it does not. The output is the
 * value of the branch that ran; with no `else`, it holds the current value. Starts at the decorated
 * indicator's value.
 *
 * `when`, `positive`, `negative`, ... build the same thing from plain values: a predicate on the
 * decorated value, then `then`, `orElse` and `defaultValue` choose what the branches give.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ConditionalRTIndicator
 */
export class ConditionalRTIndicator extends AbstractDecorableRTIndicator {
  private readonly predicate: (indicator: RTIndicator) => boolean;
  private readonly thenIndicator: RTIndicator;
  private readonly elseIndicator: RTIndicator | null;
  private form: ValueForm | null = null;

  constructor(
    indicator: RTIndicator,
    predicate: (indicator: RTIndicator) => boolean,
    thenIndicator: RTIndicator,
    elseIndicator: RTIndicator | null = null,
  ) {
    super(indicator);
    this.predicate = predicate;
    this.thenIndicator = thenIndicator;
    this.elseIndicator = elseIndicator;
    this.setValue(indicator.getValue());
  }

  /**
   * Ready when the source it tests and every branch it can take are. A branch that is only updated
   * when it is taken warms up only then, so a branch that never fires keeps the conditional from
   * being ready; the group builds branches as read-only views of indicators updated every point,
   * which do not have that problem.
   */
  override isReady(): boolean {
    return (
      super.isReady() && this.thenIndicator.isReady() && (this.elseIndicator == null || this.elseIndicator.isReady())
    );
  }

  override reset(): void {
    super.reset();
    this.indicator.reset();
    this.thenIndicator.reset();
    this.elseIndicator?.reset();
  }

  override update(newValue: number): number {
    const result = this.indicator.update(newValue);
    if (this.predicate(this.indicator)) {
      return this.setValue(this.thenIndicator.update(result));
    }
    return this.elseIndicator == null ? this.getValue() : this.setValue(this.elseIndicator.update(result));
  }

  then(operator: UnaryOperator): ConditionalRTIndicator {
    const form = this.valueForm();
    return ConditionalRTIndicator.ofValues(this.indicator, { ...form, thenOperator: operator });
  }

  orElse(operator: UnaryOperator): ConditionalRTIndicator {
    const form = this.valueForm();
    return ConditionalRTIndicator.ofValues(this.indicator, { ...form, elseOperator: operator });
  }

  defaultValue(defaultValue: number): ConditionalRTIndicator {
    const form = this.valueForm();
    return ConditionalRTIndicator.ofValues(this.indicator, { ...form, defaultValue });
  }

  static when(indicator: RTIndicator, predicate: Predicate): ConditionalRTIndicator {
    return ConditionalRTIndicator.ofValues(indicator, {
      predicate,
      defaultValue: 0,
      thenOperator: null,
      elseOperator: null,
    });
  }

  static positive(indicator: RTIndicator): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, isPositive);
  }

  static negative(indicator: RTIndicator): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, isNegative);
  }

  static positiveOrZero(indicator: RTIndicator): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, (v) => v >= 0);
  }

  static negativeOrZero(indicator: RTIndicator): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, (v) => v <= 0);
  }

  static zero(indicator: RTIndicator): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, isZero);
  }

  static greaterThan(indicator: RTIndicator, coeff: number): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, gt(coeff));
  }

  static lessThan(indicator: RTIndicator, coeff: number): ConditionalRTIndicator {
    return ConditionalRTIndicator.when(indicator, lt(coeff));
  }

  private valueForm(): ValueForm {
    if (this.form == null) {
      throw new Error("then, orElse and defaultValue apply to a conditional built with when, positive, ...");
    }
    return this.form;
  }

  private static ofValues(indicator: RTIndicator, form: ValueForm): ConditionalRTIndicator {
    const conditional = new ConditionalRTIndicator(
      indicator,
      (source) => form.predicate(source.getValue()),
      new TransformRTIndicator(new ValueRTIndicator(), form.thenOperator ?? ((v) => v)),
      new TransformRTIndicator(new ValueRTIndicator(), form.elseOperator ?? (() => form.defaultValue)),
    );
    conditional.form = form;
    return conditional;
  }
}
