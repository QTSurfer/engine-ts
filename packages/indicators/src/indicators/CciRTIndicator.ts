import { AbstractWindowSeriesRTIndicator } from "$core/AbstractWindowSeriesRTIndicator";
import { MovingAverage } from "$statistics/MovingAverage";

/**
 * Commodity Channel Index (CCI) RTIndicator.
 * Formula: CCI = (price - SMA) / (0.015 × MAD)
 * Port of com.wualabs.qtsurfer.engine.indicators.CciRTIndicator
 */
export class CciRTIndicator extends AbstractWindowSeriesRTIndicator {
  private static readonly CONSTANT = 0.015;
  private readonly movingAverage: MovingAverage;

  constructor(periods: number) {
    super(periods);
    this.movingAverage = new MovingAverage(periods);
  }

  protected override onReset(): void {
    this.movingAverage.reset();
  }

  override update(newValue: number): number {
    this.movingAverage.update(newValue);
    this.window().add(newValue);

    const mean = this.movingAverage.average;

    let mad = 0;
    const size = this.windowSize();
    for (let i = 0; i < size; i++) {
      mad += Math.abs(this.window().getValue(i) - mean);
    }
    mad /= size;

    if (mad === 0) {
      return this.setValue(0);
    }
    return this.setValue((newValue - mean) / (CciRTIndicator.CONSTANT * mad));
  }
}
