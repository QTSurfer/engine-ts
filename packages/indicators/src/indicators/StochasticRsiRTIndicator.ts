import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { MaxRTIndicator } from "$helpers/MaxRTIndicator";
import { MinRTIndicator } from "$helpers/MinRTIndicator";
import { RsiRTIndicator } from "./RsiRTIndicator";

/**
 * Stochastic RSI RTIndicator.
 * StochRSI = 100 × (RSI - minRSI) / (maxRSI - minRSI)
 * Port of com.wualabs.qtsurfer.engine.indicators.StochasticRsiRTIndicator
 */
export class StochasticRsiRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly maxRsi: MaxRTIndicator;
  private readonly minRsi: MinRTIndicator;

  constructor(periods: number);
  constructor(periods: number, indicator: RTIndicator | null);
  constructor(periods: number, indicator: RTIndicator | null, sma: boolean);
  constructor(periods: number, rsi: RsiRTIndicator);
  constructor(
    periods: number,
    indicatorOrRsi?: RTIndicator | RsiRTIndicator | null,
    sma?: boolean,
  ) {
    let rsi: RsiRTIndicator;
    if (indicatorOrRsi instanceof RsiRTIndicator) {
      rsi = indicatorOrRsi;
    } else {
      rsi = new RsiRTIndicator(periods, indicatorOrRsi ?? null, sma ?? true);
    }
    super(periods, rsi);
    this.maxRsi = new MaxRTIndicator(periods);
    this.minRsi = new MinRTIndicator(periods);
  }

  override reset(): void {
    super.reset();
    this.maxRsi.reset();
    this.minRsi.reset();
  }

  /**
   * `newValue` is the RSI of this tick: the decorated chain runs the wrapped RSI before this is
   * reached, so reading `getValue()` here would read this indicator's own previous output. A flat
   * RSI range gives 0. The result is held to [0, 100]: an RSI at an extreme of its own window can
   * overshoot by a fraction of an ULP through the division.
   */
  protected override nextValue(_prevValue: number, newValue: number): number {
    const rsi = newValue;
    const max = this.maxRsi.update(rsi);
    const min = this.minRsi.update(rsi);
    const num = rsi - min;
    if (num === 0) return 0;
    const den = max - min;
    if (den === 0) return 0;
    return Math.min(100, Math.max(0, (100 * num) / den));
  }
}
