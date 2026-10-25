import { WindowSeriesStore } from "@qtsurfer/core";
import { AbstractRTIndicator } from "$core/AbstractRTIndicator";

/**
 * Kaufman Adaptive Moving Average (KAMA) RTIndicator.
 * Adapts smoothing based on market efficiency ratio.
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.KamaRTIndicator
 */
export class KamaRTIndicator extends AbstractRTIndicator {
  private readonly window: WindowSeriesStore;
  private readonly erPeriod: number;
  private readonly fastSC: number;
  private readonly slowSC: number;
  private prevKama = 0;
  private volatilitySum = 0;
  private count = 0;

  constructor(erPeriod = 10, fastPeriod = 2, slowPeriod = 30) {
    super();
    this.erPeriod = erPeriod;
    this.window = new WindowSeriesStore(erPeriod + 1);
    this.fastSC = 2.0 / (fastPeriod + 1);
    this.slowSC = 2.0 / (slowPeriod + 1);
  }

  override isReady(): boolean {
    return this.count > this.erPeriod;
  }

  override reset(): void {
    super.reset();
    this.window.clear();
    this.prevKama = 0;
    this.volatilitySum = 0;
    this.count = 0;
  }

  override update(newValue: number): number {
    this.count++;

    if (this.count === 1) {
      this.window.add(newValue);
      this.prevKama = newValue;
      return this.setValue(newValue);
    }

    const prevClose = this.window.getValue(this.window.size - 1);
    const absChange = Math.abs(newValue - prevClose);

    this.window.add(newValue);
    this.volatilitySum += absChange;

    if (this.window.size === this.window.windowSize && this.count > this.erPeriod + 1) {
      this.volatilitySum = 0;
      for (let i = 1; i < this.window.size; i++) {
        this.volatilitySum += Math.abs(this.window.getValue(i) - this.window.getValue(i - 1));
      }
    }

    if (this.count <= this.erPeriod) {
      this.prevKama = newValue;
      return this.setValue(newValue);
    }

    const direction = Math.abs(newValue - this.window.getValue(0));
    const er = this.volatilitySum === 0 ? 0 : direction / this.volatilitySum;

    let sc = er * (this.fastSC - this.slowSC) + this.slowSC;
    sc = sc * sc;

    const kama = this.prevKama + sc * (newValue - this.prevKama);
    this.prevKama = kama;
    return this.setValue(kama);
  }
}
