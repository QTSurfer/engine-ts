import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Accumulating indicator that maintains a running sum of all values produced
 * by the decorated indicator.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.SumRTIndicator
 */
export class SumRTIndicator extends AbstractDecorableRTIndicator {
  constructor(indicator: RTIndicator) {
    super(indicator);
  }

  override update(newValue: number): number {
    return this.setValue(this.getValue() + this.indicator.update(newValue));
  }
}
