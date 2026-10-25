import type { Ticker } from "@qtsurfer/core";
import { TickerValueSource } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractSubscriptionStrategy } from "./AbstractSubscriptionStrategy";

/**
 * Base class for ticker-based strategies.
 * Port of com.wualabs.qtsurfer.engine.strategy.AbstractTickerStrategy
 */
export abstract class AbstractTickerStrategy extends AbstractSubscriptionStrategy<Ticker> {
  protected constructor(name?: string) {
    super(name);
  }

  accept(ticker: Ticker): boolean {
    return this.acceptInstrument(this.parseInstrument(ticker.instrument));
  }

  update(ticker: Ticker): void {
    const instrument = ticker.instrument;
    this.updateInstrument(instrument, ticker.timestamp);
    const indicators = this.updateIndicators(instrument, ticker);
    if (this.enableIndicatorsSignals) {
      this.emitSignal(this.getUpdatedSignal(indicators));
    }
  }

  protected override setupIndicators(
    indicators: InstrumentGroupRTIndicator,
  ): void {
    indicators
      .addPrice()
      .add("chg", TickerValueSource.PercentChange)
      .add("vwap", TickerValueSource.Vwap)
      .add("volAsk", TickerValueSource.AskSize)
      .add("volBid", TickerValueSource.BidSize);
  }
}
