import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import { CrossDetector } from "../../src/CrossDetector";

/**
 * EMA crossover strategy for E2E backtest.
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
      this.emitBuy(instrument, ticker.last ?? 0);
    }
    if (cross.below) {
      this.emitSell(instrument, ticker.last ?? 0);
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

const config: BacktestConfig = {
  initialFunding: 10000,
  feeRate: 0.001,
  currency: "USDT",
};

describe("BacktestRunner E2E", () => {
  it("runs EMA crossover strategy and produces yields", () => {
    const strategy = new EmaCrossoverStrategy();

    // Generate synthetic tickers: rise then fall then rise
    const tickers: Ticker[] = [];
    let ts = 1700000000000;
    const prices = [
      // Initial: establishes EMA baseline
      100, 100, 100, 100, 100, 100, 100,
      // Sharp rise: fast EMA crosses above slow → buy
      110, 120, 130, 140, 150, 160, 170,
      // Sharp fall: fast EMA crosses below slow → sell
      160, 140, 110, 80, 50, 30, 20,
      // Rise again → buy
      30, 50, 80, 110, 140, 170, 200,
      // Fall again → sell
      180, 150, 110, 70, 40, 20, 10,
    ];

    for (const price of prices) {
      tickers.push(makeTicker(price, ts));
      ts += 60000; // 1 minute intervals
    }

    const result = BacktestRunner.run(strategy, tickers, config);

    // Should have at least 1 completed trade
    expect(result.yields.length).toBeGreaterThanOrEqual(1);
    expect(result.totalTicks).toBe(tickers.length);
    expect(result.finalBalance).toBeGreaterThan(0);

    // Metrics should be coherent
    expect(result.metrics.totalTrades).toBe(result.yields.length);
    expect(result.metrics.winCount + result.metrics.lossCount).toBe(result.metrics.totalTrades);

    // All yields should have valid data
    for (const y of result.yields) {
      expect(y.instrument).toBe("BTC/USDT");
      expect(y.currency).toBe("USDT");
      expect(y.input).toBeGreaterThan(0);
      expect(y.output).toBeGreaterThan(0);
    }
  });

  it("no trades when price is flat", () => {
    const strategy = new EmaCrossoverStrategy();
    const tickers: Ticker[] = [];
    let ts = 1700000000000;

    for (let i = 0; i < 20; i++) {
      tickers.push(makeTicker(100, ts));
      ts += 60000;
    }

    const result = BacktestRunner.run(strategy, tickers, config);
    expect(result.yields).toHaveLength(0);
    expect(result.finalBalance).toBe(10000);
    expect(result.metrics.totalTrades).toBe(0);
  });

  it("sets backtestEnabled on strategy", () => {
    const strategy = new EmaCrossoverStrategy();
    expect(strategy.backtestEnabled).toBe(false);
    BacktestRunner.run(strategy, [], config);
    expect(strategy.backtestEnabled).toBe(true);
  });
});
