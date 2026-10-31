import type { Kline, Ticker } from "@qtsurfer/core";
import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RichRTIndicator } from "$core/RTIndicator";

/**
 * Average True Range (ATR) with O(1) per-tick Wilder's smoothing.
 * Port of com.wualabs.qtsurfer.engine.indicators.volatility.AtrRTIndicator
 *
 * In a group it reads each bar's high, low and close through {@link updateFrom}, so it belongs on a
 * kline group: on a ticker the high and low are the exchange's 24-hour statistics, and the value
 * stops meaning what its name says.
 */
export class AtrRTIndicator extends AbstractRTIndicator implements RichRTIndicator<Kline | Ticker> {
  private readonly _periods: number;
  private prevClose = 0;
  private atrValue = 0;
  private count = 0;
  private trSum = 0;

  constructor(periods: number) {
    super();
    this._periods = periods;
  }

  get periods(): number {
    return this._periods;
  }

  /** It reads each bar's high, low and close: a group fed from a ticker raises a notice for it. */
  requiresBarData(): boolean {
    return true;
  }

  override isReady(): boolean {
    return this.count >= this._periods;
  }

  override reset(): void {
    super.reset();
    this.prevClose = 0;
    this.atrValue = 0;
    this.count = 0;
    this.trSum = 0;
  }

  /**
   * Updates from a bar, or from a ticker with its last price as the close, as the Java engine's
   * `updateFrom(MarketSnapshot)` does.
   */
  updateFrom(source: Kline | Ticker): void {
    const close = "close" in source ? source.close : source.last;
    this.updateOhlc(source.high ?? NaN, source.low ?? NaN, close ?? NaN);
  }

  /**
   * Updates ATR from OHLC primitive values directly. A value that is missing or not finite leaves
   * the indicator as it was.
   */
  updateOhlc(high: number, low: number, close: number): number {
    if (AbstractRTIndicator.isPoison(high) || AbstractRTIndicator.isPoison(low) || AbstractRTIndicator.isPoison(close)) {
      return this.getValue();
    }
    this.count++;
    let tr: number;
    if (this.count === 1) {
      tr = high - low;
    } else {
      tr = Math.max(high - low, Math.max(Math.abs(high - this.prevClose), Math.abs(low - this.prevClose)));
    }
    this.prevClose = close;

    if (this.count <= this._periods) {
      this.trSum += tr;
      if (this.count === this._periods) {
        this.atrValue = this.trSum / this._periods;
      } else {
        this.atrValue = this.trSum / this.count;
      }
    } else {
      this.atrValue += (tr - this.atrValue) / this._periods;
    }
    return this.setValue(this.atrValue);
  }

  /**
   * Standalone mode — treats input as a pre-computed True Range value.
   */
  override update(newValue: number): number {
    this.count++;
    if (this.count <= this._periods) {
      this.trSum += newValue;
      if (this.count === this._periods) {
        this.atrValue = this.trSum / this._periods;
      } else {
        this.atrValue = this.trSum / this.count;
      }
    } else {
      this.atrValue += (newValue - this.atrValue) / this._periods;
    }
    return this.setValue(this.atrValue);
  }
}
