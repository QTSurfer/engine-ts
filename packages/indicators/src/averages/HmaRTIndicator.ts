import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { WmaRTIndicator } from "./WmaRTIndicator";

/**
 * Hull Moving Average (HMA) RTIndicator.
 * Formula: HMA(n) = WMA(√n, 2×WMA(n/2) - WMA(n))
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.HmaRTIndicator
 */
export class HmaRTIndicator extends AbstractRTIndicator {
  private readonly wmaHalf: WmaRTIndicator;
  private readonly wmaFull: WmaRTIndicator;
  private readonly wmaResult: WmaRTIndicator;
  private readonly _periods: number;

  constructor(periods: number) {
    super();
    this._periods = periods;
    this.wmaHalf = new WmaRTIndicator(Math.floor(periods / 2));
    this.wmaFull = new WmaRTIndicator(periods);
    this.wmaResult = new WmaRTIndicator(Math.round(Math.sqrt(periods)));
  }

  get periods(): number {
    return this._periods;
  }

  override isReady(): boolean {
    return this.wmaFull.isReady();
  }

  override reset(): void {
    super.reset();
    this.wmaHalf.reset();
    this.wmaFull.reset();
    this.wmaResult.reset();
  }

  override update(newValue: number): number {
    const half = this.wmaHalf.update(newValue);
    const full = this.wmaFull.update(newValue);
    const diff = 2 * half - full;
    return this.setValue(this.wmaResult.update(diff));
  }
}
