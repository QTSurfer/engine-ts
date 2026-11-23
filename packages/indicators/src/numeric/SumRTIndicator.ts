import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Accumulating indicator that maintains a running sum of the values produced by the decorated
 * indicator once it is ready.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.SumRTIndicator
 */
export class SumRTIndicator extends AbstractDecorableRTIndicator {
  constructor(indicator: RTIndicator) {
    super(indicator);
  }

  /**
   * Adds the value of the decorated indicator once it is ready: the values it gives while it warms
   * up (an RSI starts at 0) are not part of what it measures, and a sum has no way to take them
   * back. Until then the sum holds the 0 it starts with.
   */
  override update(newValue: number): number {
    const value = this.indicator.update(newValue);
    if (!this.indicator.isReady()) {
      return this.getValue();
    }
    return this.setValue(this.getValue() + value);
  }
}
