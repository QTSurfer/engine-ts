import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { EmaRTIndicator } from "./EmaRTIndicator";

/**
 * Triple Exponential Moving Average (TEMA) RTIndicator.
 * Formula: TEMA = 3×EMA1 - 3×EMA2 + EMA3
 * where EMA1 = EMA(price), EMA2 = EMA(EMA1), EMA3 = EMA(EMA2).
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.TemaRTIndicator
 */
export class TemaRTIndicator extends AbstractRTIndicator {
  private readonly ema1: EmaRTIndicator;
  private readonly ema2: EmaRTIndicator;
  private readonly ema3: EmaRTIndicator;

  constructor(periods: number) {
    super();
    this.ema1 = new EmaRTIndicator(periods);
    this.ema2 = new EmaRTIndicator(periods);
    this.ema3 = new EmaRTIndicator(periods);
  }

  override isReady(): boolean {
    return this.ema3.isReady();
  }

  override reset(): void {
    super.reset();
    this.ema1.reset();
    this.ema2.reset();
    this.ema3.reset();
  }

  override update(newValue: number): number {
    const e1 = this.ema1.update(newValue);
    const e2 = this.ema2.update(e1);
    const e3 = this.ema3.update(e2);
    return this.setValue(3 * e1 - 3 * e2 + e3);
  }
}
