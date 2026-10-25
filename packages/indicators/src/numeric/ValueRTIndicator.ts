import { AbstractRTIndicator } from "$core/AbstractRTIndicator";

/**
 * Simplest RT Indicator holding a value.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ValueRTIndicator
 */
export class ValueRTIndicator extends AbstractRTIndicator {
  constructor(value = 0) {
    super();
    this.update(value);
  }

  static of(value: number): ValueRTIndicator {
    return new ValueRTIndicator(value);
  }
}
