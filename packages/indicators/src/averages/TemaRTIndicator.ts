import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { EmaRTIndicator } from "./EmaRTIndicator";

/**
 * Triple Exponential Moving Average (TEMA) RTIndicator.
 * Formula: TEMA = 3×EMA1 - 3×EMA2 + EMA3
 * where EMA1 = EMA(price), EMA2 = EMA(EMA1), EMA3 = EMA(EMA2).
 *
 * Each of the three needs `periods` values of the one before it, so the indicator is ready at
 * update `3 * (periods - 1) + 1`: the look-back of the same indicator in TA-Lib. The averages start
 * from the first value they see, so at that update that first value still weighs about 13% of the
 * result; it weighs under 1% from update `3.5 * periods` on. The updates that count are the finite
 * ones.
 *
 * A non-finite input (NaN or an infinity) is ignored: no average is updated and the previous value
 * is returned.
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.TemaRTIndicator
 */
export class TemaRTIndicator extends AbstractRTIndicator {
  private readonly ema1: EmaRTIndicator;
  private readonly ema2: EmaRTIndicator;
  private readonly ema3: EmaRTIndicator;
  private readonly warmUp: number;
  private updates = 0;

  constructor(periods: number) {
    super();
    this.ema1 = new EmaRTIndicator(periods);
    this.ema2 = new EmaRTIndicator(periods);
    this.ema3 = new EmaRTIndicator(periods);
    this.warmUp = 3 * (periods - 1) + 1;
  }

  override isReady(): boolean {
    return this.updates >= this.warmUp;
  }

  override reset(): void {
    super.reset();
    this.ema1.reset();
    this.ema2.reset();
    this.ema3.reset();
    this.updates = 0;
  }

  override update(newValue: number): number {
    if (AbstractRTIndicator.isPoison(newValue)) {
      return this.getValue();
    }
    if (this.updates < this.warmUp) {
      this.updates++;
    }
    const e1 = this.ema1.update(newValue);
    const e2 = this.ema2.update(e1);
    const e3 = this.ema3.update(e2);
    return this.setValue(3 * e1 - 3 * e2 + e3);
  }
}
