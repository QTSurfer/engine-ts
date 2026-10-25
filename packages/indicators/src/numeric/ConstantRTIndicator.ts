import { AbstractRTIndicator } from "$core/AbstractRTIndicator";

/**
 * Immutable RT Indicator holding a constant value.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ConstantRTIndicator
 */
export class ConstantRTIndicator extends AbstractRTIndicator {
  static readonly ZERO = ConstantRTIndicator.of(0);
  static readonly ONE = ConstantRTIndicator.of(1);
  static readonly TWO = ConstantRTIndicator.of(2);
  static readonly TEN = ConstantRTIndicator.of(10);
  static readonly HUNDRED = ConstantRTIndicator.of(100);

  constructor(value: number) {
    super();
    super.setValue(value);
  }

  static of(value: number): ConstantRTIndicator {
    return new ConstantRTIndicator(value);
  }

  protected override setValue(_value: number): number {
    return this.getValue();
  }

  override update(_newValue: number): number {
    return this.getValue();
  }
}
