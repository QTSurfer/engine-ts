import { AbstractWindowSeriesRTIndicator } from "$core/AbstractWindowSeriesRTIndicator";

/**
 * Weighted Moving Average (WMA) RTIndicator.
 * Weight for position i (0-based, oldest first) is (i+1).
 * Formula: WMA = Σ(weight_i × value_i) / Σ(weight_i)
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.WmaRTIndicator
 */
export class WmaRTIndicator extends AbstractWindowSeriesRTIndicator {
  constructor(periods: number) {
    super(periods);
  }

  override update(newValue: number): number {
    this.window().add(newValue);
    const size = this.windowSize();
    let weightedSum = 0;
    let divisor = 0;
    for (let i = 0; i < size; i++) {
      const weight = i + 1;
      weightedSum += weight * this.window().getValue(i);
      divisor += weight;
    }
    return this.setValue(weightedSum / divisor);
  }
}
