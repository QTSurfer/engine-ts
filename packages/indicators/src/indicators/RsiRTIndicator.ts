import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";

/**
 * RSI RTIndicator.
 * RSI = 100 - 100/(1+RS) where RS = avgGain/avgLoss. The averages are those of a simple moving average
 * by default (`sma = true`, Cutler's RSI: the block averages of `SmaRTIndicator`, refreshed at the end of
 * each period of `periods` ticks) or Wilder's smoothing (`sma = false`, what TA-Lib and ta4j compute).
 *
 * When there is nothing to divide. The formula is undefined when the averages are both 0 (no gain and no
 * loss in the window: the price did not move) and Wilder does not say what to return. This indicator
 * follows TA-Lib and ta4j, as the Java engine does:
 *
 * - no gain and no loss: 0;
 * - gains and no loss: 100;
 * - losses and no gain: 0.
 *
 * Other libraries choose differently for the first case (the Python `ta`, `technicalindicators` and
 * `trading-signals` return 100, `finta` returns NaN), so a value read as "oversold" or "overbought" says
 * nothing on a series that does not move: a rule such as `rsi < 30` fires on a flat market. What follows
 * from it:
 *
 * - a series that has never moved reads 0;
 * - with `sma = true`, a rise followed by a plateau reads 100 until the first whole period without a
 *   gain ends, and 0 from then on;
 * - with `sma = false`, the average gain only decays, never reaching 0 in practice, so the same plateau
 *   stays at 100.
 *
 * In the cases above `getRelativeStrength()` holds the value that was returned (0 or 100), not a ratio.
 * The tests "no movement" pin all of this.
 * Port of com.wualabs.qtsurfer.engine.indicators.RsiRTIndicator
 */
export class RsiRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly averageGainIndicator: RTIndicator;
  private readonly averageLossIndicator: RTIndicator;
  private relativeStrength = 0;

  constructor();
  constructor(periods: number);
  constructor(periods: number, sma: boolean);
  constructor(periods: number, indicator: RTIndicator);
  constructor(periods: number, indicator: RTIndicator | null, sma: boolean);
  constructor(
    periods?: number,
    indicatorOrSma?: RTIndicator | boolean | null,
    sma?: boolean,
  ) {
    const p = periods ?? 0;
    let ind: RTIndicator | null = null;
    let useSma = true;

    if (typeof indicatorOrSma === "boolean") {
      useSma = indicatorOrSma;
    } else if (indicatorOrSma != null) {
      ind = indicatorOrSma;
      useSma = sma ?? true;
    } else {
      useSma = sma ?? true;
    }

    super(p, ind);

    if (useSma) {
      this.averageGainIndicator = new SmaRTIndicator(p, new GainRTIndicator());
      this.averageLossIndicator = new SmaRTIndicator(p, new LossRTIndicator());
    } else {
      this.averageGainIndicator = new MmaRTIndicator(p, new GainRTIndicator());
      this.averageLossIndicator = new MmaRTIndicator(p, new LossRTIndicator());
    }
  }

  override reset(): void {
    super.reset();
    this.relativeStrength = 0;
    this.averageGainIndicator.reset();
    this.averageLossIndicator.reset();
  }

  getRelativeStrength(): number {
    return this.relativeStrength;
  }

  protected override initValue(initValue: number): number {
    this.averageGainIndicator.update(initValue);
    this.averageLossIndicator.update(initValue);
    return 0;
  }

  protected override getPrevValue(): number {
    return this.lastUpdateValue;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    const averageGain = this.averageGainIndicator.update(newValue);
    const averageLoss = this.averageLossIndicator.update(newValue);
    if (averageLoss === 0) {
      if (averageGain === 0) {
        return (this.relativeStrength = 0);
      } else {
        return (this.relativeStrength = 100);
      }
    }
    if (averageGain === 0) {
      return (this.relativeStrength = 0);
    }
    this.relativeStrength = averageGain / averageLoss;
    return 100 - 100 / (1 + this.relativeStrength);
  }
}
