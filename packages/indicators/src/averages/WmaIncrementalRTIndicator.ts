import { AbstractWindowSeriesRTIndicator } from "$core/AbstractWindowSeriesRTIndicator";

/**
 * Weighted Moving Average (WMA) with O(1) incremental updates.
 * Uses running accumulators instead of O(n) recomputation.
 * Port of com.wualabs.qtsurfer.engine.indicators.pro.WmaRTIndicator
 */
export class WmaIncrementalRTIndicator extends AbstractWindowSeriesRTIndicator {
  private readonly divisor: number;
  private weightedSum = 0;
  private plainSum = 0;

  constructor(periods: number) {
    super(periods);
    this.divisor = periods * (periods + 1) / 2;
  }

  protected override onEvict(evicted: number): void {
    this.weightedSum -= this.plainSum;
    this.plainSum -= evicted;
  }

  protected override onReset(): void {
    this.weightedSum = 0;
    this.plainSum = 0;
  }

  override update(newValue: number): number {
    this.window().add(newValue);
    const size = this.windowSize();
    this.plainSum += newValue;
    this.weightedSum += size * newValue;
    const currentDivisor = size < this.periods ? size * (size + 1) / 2 : this.divisor;
    return this.setValue(this.weightedSum / currentDivisor);
  }
}
