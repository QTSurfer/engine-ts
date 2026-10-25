/**
 * Kline enumeration of value sources.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.KlineValueSource
 */
export enum KlineValueSource {
  Open = "Open",
  High = "High",
  Low = "Low",
  Close = "Close",
  Volume = "Volume",
  VolumeQuote = "VolumeQuote",
  NumberOfTrades = "NumberOfTrades",
}

import type { Kline } from "./Kline";

/**
 * Extracts a numeric value from a Kline based on the specified value source.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.KlineSnapshots
 */
export function getKlineValue(
  kline: Kline,
  source: KlineValueSource,
): number | null {
  switch (source) {
    case KlineValueSource.Open:
      return kline.open;
    case KlineValueSource.High:
      return kline.high;
    case KlineValueSource.Low:
      return kline.low;
    case KlineValueSource.Close:
      return kline.close;
    case KlineValueSource.Volume:
      return kline.volume;
    case KlineValueSource.VolumeQuote:
      return kline.quoteVolume;
    case KlineValueSource.NumberOfTrades:
      return kline.numberOfTrades;
  }
}
