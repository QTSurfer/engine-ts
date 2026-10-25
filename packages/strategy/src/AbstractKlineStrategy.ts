import type { Kline } from "@qtsurfer/core";
import { KlineValueSource } from "@qtsurfer/core";
import { InstrumentGroupRTIndicator, InstrumentMapKlineSourceRTIndicator } from "@qtsurfer/indicators";
import { AbstractSubscriptionStrategy } from "./AbstractSubscriptionStrategy";

/**
 * Base class for kline (OHLCV candlestick) based strategies.
 * Receives Kline data, feeds it natively into the indicator chain via
 * InstrumentMapKlineSourceRTIndicator — no Ticker bridge.
 * Only OHLCV-based indicators (EMA, SMA, RSI, Bollinger, etc.) are supported;
 * ticker-only sources (bid, ask, vwap, percentageChange) are not available.
 *
 * Port of com.wualabs.qtsurfer.engine.strategy.AbstractKlineStrategy
 */
export abstract class AbstractKlineStrategy extends AbstractSubscriptionStrategy<Kline> {
  protected constructor(name?: string) {
    super(name);
  }

  accept(kline: Kline): boolean {
    return this.acceptInstrument(this.parseInstrument(kline.instrument));
  }

  update(kline: Kline): void {
    const instrument = kline.instrument;
    this.updateInstrument(instrument, kline.timestamp);
    const indicators = this.updateIndicators(instrument, kline);
    if (this.enableIndicatorsSignals) {
      this.emitSignal(this.getUpdatedSignal(indicators));
    }
  }

  protected override createInstrumentGroupRTIndicator(
    instrument: string,
  ): InstrumentGroupRTIndicator {
    return new InstrumentGroupRTIndicator(
      new InstrumentMapKlineSourceRTIndicator(instrument),
    );
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    // Klines expose OHLCV only — no order-book sizes, vwap or percentageChange
    indicators.add("price", KlineValueSource.Close);
  }
}
