import type { RTIndicator } from "$core/RTIndicator";
import { VolatilityRTIndicator } from "./VolatilityRTIndicator";

/**
 * Volatility as the average absolute percent change between consecutive values, optionally
 * amplified.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.PercentVolatilityRTIndicator
 */
export class PercentVolatilityRTIndicator extends VolatilityRTIndicator {
  private amplifyBy = 1;

  /** @param averageIndicator the averaging indicator fed each percent change; an SMA by default */
  constructor(averageIndicator?: RTIndicator) {
    super(averageIndicator);
  }

  /** Multiplies each percent change by `amplify` (0 means 1). */
  amplify(amplify: number): this {
    this.amplifyBy = amplify === 0 ? 1 : amplify;
    return this;
  }

  protected override nextValue(averageIndicator: RTIndicator, prevValue: number, newValue: number): number {
    if (prevValue === 0) {
      return averageIndicator.update(0);
    }
    return averageIndicator.update(Math.abs((newValue - prevValue) / prevValue) * 100 * this.amplifyBy);
  }
}
