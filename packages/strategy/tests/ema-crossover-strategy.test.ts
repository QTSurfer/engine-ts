import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { BuySignal } from "../src/event/signal/BuySignal";
import { SellSignal } from "../src/event/signal/SellSignal";
import type { StrategySignal } from "../src/event/signal/StrategySignal";
import { CrossDetector } from "../src/CrossDetector";

/**
 * E2E test: A simple EMA crossover strategy.
 * Buys when fast EMA crosses above slow EMA.
 * Sells when fast EMA crosses below slow EMA.
 */
class EmaCrossoverStrategy extends AbstractTickerStrategy {
  private readonly cross = new CrossDetector();

  constructor() {
    super("EmaCrossover");
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 3).ema("emaSlow", 7);
  }

  override update(ticker: Ticker): void {
    const instrument = ticker.instrument;
    this.updateInstrument(instrument, ticker.timestamp);
    const indicators = this.updateIndicators(instrument, ticker);

    const fast = indicators.getIndicatorValue("emaFast");
    const slow = indicators.getIndicatorValue("emaSlow");

    const cross = this.cross.check(fast, slow);
    if (cross.above) {
      this.emitBuy(instrument, ticker.last ?? ticker.ask ?? 0);
    }
    if (cross.below) {
      this.emitSell(instrument, ticker.last ?? ticker.ask ?? 0);
    }
  }
}

function makeTicker(price: number, ts: number): Ticker {
  return {
    instrument: "BTC/USDT",
    open: price,
    high: price,
    low: price,
    last: price,
    bid: price - 1,
    bidSize: 1,
    ask: price + 1,
    askSize: 1,
    volume: 100,
    quoteVolume: 10000,
    vwap: price,
    percentageChange: 0,
    timestamp: ts,
  };
}

describe("EmaCrossoverStrategy E2E", () => {
  it("emits buy and sell signals on EMA crossovers", () => {
    const strategy = new EmaCrossoverStrategy();
    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));

    // Feed rising prices — fast EMA should cross above slow EMA
    const risingPrices = [100, 102, 105, 110, 115, 120, 125, 130, 135, 140];
    let ts = 1700000000000;
    for (const price of risingPrices) {
      strategy.update(makeTicker(price, ts));
      ts += 1000;
    }

    // Check if at least one buy signal was emitted
    const buySignals = signals.filter((s) => s instanceof BuySignal);

    // Now feed sharply falling prices — fast EMA should cross below slow EMA
    const fallingPrices = [130, 110, 80, 50, 30, 20, 15, 10, 8, 5, 3, 2, 1];
    for (const price of fallingPrices) {
      strategy.update(makeTicker(price, ts));
      ts += 1000;
    }

    const allBuySignals = signals.filter((s) => s instanceof BuySignal);
    const sellSignals = signals.filter((s) => s instanceof SellSignal);

    // We should have at least one buy (from rising) and one sell (from falling)
    expect(allBuySignals.length).toBeGreaterThanOrEqual(1);
    expect(sellSignals.length).toBeGreaterThanOrEqual(1);

    // Verify signal properties
    const firstBuy = buySignals[0] as BuySignal;
    expect(firstBuy.instrument).toBe("BTC/USDT");
    expect(firstBuy.price).toBeGreaterThan(0);

    const firstSell = sellSignals[0] as SellSignal;
    expect(firstSell.instrument).toBe("BTC/USDT");
    expect(firstSell.price).toBeGreaterThan(0);
  });

  it("stats track instrument updates", () => {
    const strategy = new EmaCrossoverStrategy();
    strategy.update(makeTicker(100, 1700000000000));
    strategy.update(makeTicker(105, 1700000001000));
    strategy.update(makeTicker(110, 1700000002000));

    expect(strategy.stats.getInstrumentUpdates()).toBe(3);
    expect(strategy.instruments.has("BTC/USDT")).toBe(true);
  });
});
