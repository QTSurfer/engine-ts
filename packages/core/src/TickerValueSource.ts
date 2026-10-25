/**
 * Ticker enumeration of value sources.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.TickerValueSource
 */
export enum TickerValueSource {
  Bid = "Bid",
  BidSize = "BidSize",
  Ask = "Ask",
  AskSize = "AskSize",
  Open = "Open",
  High = "High",
  Low = "Low",
  Close = "Close",
  Vwap = "Vwap",
  Volume = "Volume",
  VolumeQuote = "VolumeQuote",
  PercentChange = "PercentChange",
  AutoAskClose = "AutoAskClose",
}

import type { Ticker } from "./Ticker";

/**
 * Extracts a numeric value from a Ticker based on the specified value source.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.TickerRTIndicatorSource.getValue()
 */
export function getTickerValue(
  ticker: Ticker,
  source: TickerValueSource,
): number | null {
  switch (source) {
    case TickerValueSource.Bid:
      return ticker.bid;
    case TickerValueSource.BidSize:
      return ticker.bidSize;
    case TickerValueSource.Ask:
      return ticker.ask;
    case TickerValueSource.AskSize:
      return ticker.askSize;
    case TickerValueSource.Open:
      return ticker.open;
    case TickerValueSource.High:
      return ticker.high;
    case TickerValueSource.Low:
      return ticker.low;
    case TickerValueSource.Close:
      return ticker.last;
    case TickerValueSource.Vwap:
      return ticker.vwap;
    case TickerValueSource.Volume:
      return ticker.volume;
    case TickerValueSource.VolumeQuote:
      return ticker.quoteVolume;
    case TickerValueSource.PercentChange:
      return ticker.percentageChange;
    case TickerValueSource.AutoAskClose:
      // A last price that is missing or NaN falls back to the ask, as in the Java engine
      if (ticker.last != null && !Number.isNaN(ticker.last)) {
        return ticker.last;
      }
      return ticker.ask;
  }
}
