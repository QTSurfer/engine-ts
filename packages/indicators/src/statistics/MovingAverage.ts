import { WindowSeriesStore } from "@qtsurfer/core";

/**
 * O(1) rolling moving average using a ring buffer.
 * Port of com.wualabs.qtsurfer.engine.indicators.statistics.MovingAverage
 */
export class MovingAverage extends WindowSeriesStore {
  private sum = 0;

  constructor(periods: number) {
    super(periods);
  }

  update(value: number): void {
    this.add(value);
    this.sum += value;
  }

  reset(): void {
    this.clear();
    this.sum = 0;
  }

  get average(): number {
    return this.sum / this.size;
  }

  get averageSample(): number {
    return this.sum / (this.size - 1);
  }

  protected override onRollingWindow(firstValue: number): void {
    this.sum -= firstValue;
  }
}
