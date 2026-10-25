import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";

/**
 * MACD RTIndicator — shortEMA - longEMA.
 * Port of com.wualabs.qtsurfer.engine.indicators.MacdRTIndicator
 */
export class MacdRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly shortEma: EmaRTIndicator;
  private readonly longEma: EmaRTIndicator;

  constructor();
  constructor(indicator: RTIndicator);
  constructor(indicator: RTIndicator | null, shortEmaPeriods: number, longEmaPeriods: number);
  constructor(indicator?: RTIndicator | null, shortEmaPeriods = 12, longEmaPeriods = 26) {
    super();
    this.shortEma = new EmaRTIndicator(shortEmaPeriods, indicator ?? null);
    this.longEma = new EmaRTIndicator(longEmaPeriods, indicator ?? null);
  }

  /**
   * Ready when both EMAs are, which is when the slower of the two is. MACD is the difference of
   * two averages, so it says nothing while either is still warming up.
   */
  override isReady(): boolean {
    return super.isReady() && this.shortEma.isReady() && this.longEma.isReady();
  }

  override reset(): void {
    super.reset();
    this.shortEma.reset();
    this.longEma.reset();
  }

  override update(newValue: number): number {
    return super.update(this.shortEma.update(newValue) - this.longEma.update(newValue));
  }
}
