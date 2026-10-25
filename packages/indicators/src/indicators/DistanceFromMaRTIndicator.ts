import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";

/**
 * Computes the relative distance from the close price to a moving average:
 * (close - ma) / ma.
 * Port of com.wualabs.qtsurfer.engine.indicators.DistanceFromMaRTIndicator
 */
export class DistanceFromMaRTIndicator extends AbstractRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "distanceMa";

  private readonly maIndicator: RTIndicator;
  private lastClosePrice = 0;

  constructor(maIndicator: RTIndicator) {
    super();
    this.maIndicator = maIndicator;
  }

  override update(newValue: number): number {
    this.lastClosePrice = newValue;
    const maValue = this.maIndicator.update(newValue);
    return this.setValue(maValue === 0 ? 0 : (this.lastClosePrice - maValue) / maValue);
  }

  override isReady(): boolean {
    return this.maIndicator.isReady();
  }

  override reset(): void {
    super.reset();
    this.lastClosePrice = 0;
    this.maIndicator.reset();
  }

  static sma(periods: number): DistanceFromMaRTIndicator {
    return new DistanceFromMaRTIndicator(new SmaRTIndicator(periods));
  }

  static ema(periods: number): DistanceFromMaRTIndicator {
    return new DistanceFromMaRTIndicator(new EmaRTIndicator(periods));
  }
}
