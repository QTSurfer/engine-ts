import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { WmaRTIndicator } from "./WmaRTIndicator";

/**
 * Hull Moving Average (HMA) RTIndicator.
 * Formula: HMA(n) = WMA(√n, 2×WMA(n/2) - WMA(n))
 *
 * The final average is fed from the update where the full-length one is ready, so the indicator is
 * ready, and equal to the formula, from update `n + round(√n) - 1` (19 for 16).
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

  /**
   * Ready when the final average has a full window of valid differences: the full-length average
   * needs `periods` updates, and the final one then needs `round(sqrt(periods))` of them, so
   * `periods + round(sqrt(periods)) - 1` in all.
   */
  override isReady(): boolean {
    return this.wmaResult.isReady();
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
    // The difference is a value of the line only once the full-length average is: before that it
    // is made with an average that is still filling, and the final average would keep it in its
    // window for as many updates as it is long. Until then the indicator reads the difference itself.
    if (!this.wmaFull.isReady()) {
      return this.setValue(diff);
    }
    return this.setValue(this.wmaResult.update(diff));
  }
}
