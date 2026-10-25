import { AbstractDecorableIncrementalRTIndicator } from "./AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "./RTIndicator";

/**
 * Base class for EMA-style indicators.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractEmaRTIndicator
 */
export abstract class AbstractEmaRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly alpha: number;

  protected constructor(periods: number, alpha: number, indicator: RTIndicator | null) {
    super(periods, indicator);
    this.alpha = alpha;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    return prevValue + this.alpha * (newValue - prevValue);
  }
}
