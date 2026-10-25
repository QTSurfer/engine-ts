import type { Ticker } from "@qtsurfer/core";

export function makeTicker(price: number, ts: number, instrument = "BTC/USDT"): Ticker {
  return {
    instrument,
    open: price,
    high: price * 1.01,
    low: price * 0.99,
    last: price,
    bid: price - 0.1,
    bidSize: 1,
    ask: price + 0.1,
    askSize: 1,
    volume: 1000,
    quoteVolume: price * 1000,
    vwap: price,
    percentageChange: 0,
    timestamp: ts,
  };
}
