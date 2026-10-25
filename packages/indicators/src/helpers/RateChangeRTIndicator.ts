import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Gets the rate of change of an RTIndicator between updates.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.RateChangeRTIndicator
 */
export class RateChangeRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "rateChange";

  constructor(indicator?: RTIndicator | null) {
    super(indicator as RTIndicator);
  }

  protected override initValue(_initValue: number): number {
    return 0;
  }

  protected override getPrevValue(): number {
    return this.lastUpdateValue;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    if (prevValue === 0) return 0;
    return (newValue - prevValue) / Math.abs(prevValue);
  }
}
