import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Rounds the output of a decorated indicator to a specified number of decimal places.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.RoundRTIndicator
 */
export class RoundRTIndicator extends AbstractDecorableRTIndicator {
  private readonly decimals: number;

  constructor(indicator: RTIndicator, decimals: number) {
    super(indicator);
    this.decimals = decimals;
  }

  override update(newValue: number): number {
    const raw = this.indicator.update(newValue);
    const factor = Math.pow(10, this.decimals);
    return this.setValue(Math.round(raw * factor) / factor);
  }
}
