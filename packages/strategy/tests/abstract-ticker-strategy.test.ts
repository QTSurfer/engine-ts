import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { TickerValueSource, getTickerValue } from "@qtsurfer/core";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { BuySignal } from "../src/event/signal/BuySignal";
import { SellSignal } from "../src/event/signal/SellSignal";
import { InfoStrategySignal } from "../src/event/signal/InfoStrategySignal";
import type { StrategySignal } from "../src/event/signal/StrategySignal";

class TestTickerStrategy extends AbstractTickerStrategy {
  constructor() {
    super("TestTickerStrategy");
  }

  // Expose protected methods for testing
  testEmitBuy(instrument: string, price: number): void {
    this.emitBuy(instrument, price);
  }

  testEmitSell(instrument: string, price: number): void {
    this.emitSell(instrument, price);
  }

  testEmitInfo(instrument: string): void {
    this.emitInfo(instrument);
  }

  testCreateBuySignal(instrument: string, price: number): BuySignal {
    return this.createBuySignal(instrument, price);
  }

  testCreateSellSignal(instrument: string, price: number): SellSignal {
    return this.createSellSignal(instrument, price);
  }

  testEmitSignal(signal: StrategySignal): void {
    this.emitSignal(signal);
  }
}

const INSTRUMENT = "BTC/USDT";

const TEST_TICKER: Ticker = {
  instrument: INSTRUMENT,
  open: 100,
  high: 110,
  low: 90,
  last: 105,
  bid: 104,
  bidSize: 1.5,
  ask: 106,
  askSize: 2.0,
  volume: 5000,
  quoteVolume: 500000,
  vwap: 103,
  percentageChange: 5.0,
  timestamp: 1700000000000,
};

const BTC_USDT: Ticker = {
  instrument: INSTRUMENT,
  open: null,
  high: null,
  low: null,
  last: null,
  bid: null,
  bidSize: null,
  ask: 50000,
  askSize: null,
  volume: null,
  quoteVolume: null,
  vwap: null,
  percentageChange: null,
  timestamp: 1700000000000,
};

describe("AbstractTickerStrategy", () => {
  let strategy: TestTickerStrategy;

  function setUp() {
    strategy = new TestTickerStrategy();
    strategy.enableIndicatorsSignals = true;
  }

  it("reset", () => {
    setUp();
    strategy.reset(INSTRUMENT);
  });

  it("update emits info signal with indicator values", () => {
    setUp();
    const indicatorName = "testEma";
    strategy.getInstrumentIndicatorGroup(INSTRUMENT).ema(indicatorName, 12);

    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));

    strategy.update(BTC_USDT);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as InfoStrategySignal;
    expect(signal).toBeInstanceOf(InfoStrategySignal);
    const indicatorValue = signal.get<number>(indicatorName);
    expect(indicatorValue).toBeDefined();
    // AutoAskClose with last=null falls back to ask=50000
    expect(indicatorValue).toBe(BTC_USDT.ask);
  });

  it("update with all TickerValueSource values", () => {
    setUp();
    const indicatorName = "indicator";

    for (const tickerValueSource of Object.values(TickerValueSource)) {
      strategy
        .getInstrumentIndicatorGroup(TEST_TICKER.instrument)
        .add(indicatorName, tickerValueSource);

      const signals: StrategySignal[] = [];
      strategy.onSignal((s) => signals.push(s));

      strategy.update(TEST_TICKER);

      expect(signals).toHaveLength(1);
      const signal = signals[0] as InfoStrategySignal;
      expect(signal).toBeDefined();

      const expectedValue = getTickerValue(TEST_TICKER, tickerValueSource);
      expect(expectedValue).not.toBeNull();

      const indicatorValue = signal.get<number>(indicatorName);
      expect(indicatorValue).toBe(expectedValue);

      // Reset for next iteration
      strategy.reset(TEST_TICKER.instrument);
      signals.length = 0;
    }
  });

  it("createInfoStrategySignal", () => {
    setUp();
    const result = strategy.createInfoStrategySignal(INSTRUMENT);
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(InfoStrategySignal);
  });

  it("getRTIndicator returns undefined for missing", () => {
    setUp();
    const result = (strategy as any).getRTIndicator(INSTRUMENT, "");
    expect(result).toBeUndefined();
  });

  it("getRTIndicator returns indicator after setup", () => {
    setUp();
    strategy.getInstrumentIndicatorGroup(INSTRUMENT).addPrice();
    const result = (strategy as any).getRTIndicator(INSTRUMENT, "price");
    expect(result).toBeDefined();
  });

  it("getStateStore returns StateStore", () => {
    setUp();
    const result = strategy.getStateStore(INSTRUMENT);
    expect(result).toBeDefined();
  });

  it("getInstrumentIndicatorGroup creates group", () => {
    setUp();
    const result = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    expect(result).toBeDefined();
    expect(result.instrument).toBe(INSTRUMENT);
  });

  it("emitBuy emits BuySignal", () => {
    setUp();
    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));
    strategy.testEmitBuy(INSTRUMENT, 50000);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(BuySignal);
    const buy = signals[0] as BuySignal;
    expect(buy.instrument).toBe(INSTRUMENT);
    expect(buy.price).toBe(50000);
  });

  it("emitSell emits SellSignal", () => {
    setUp();
    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));
    strategy.testEmitSell(INSTRUMENT, 60000);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(SellSignal);
    const sell = signals[0] as SellSignal;
    expect(sell.instrument).toBe(INSTRUMENT);
    expect(sell.price).toBe(60000);
  });

  it("emitInfo emits InfoStrategySignal", () => {
    setUp();
    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));
    strategy.testEmitInfo(INSTRUMENT);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(InfoStrategySignal);
    expect(signals[0].instrument).toBe(INSTRUMENT);
  });

  it("createBuySignal with metadata", () => {
    setUp();
    const buy = strategy.testCreateBuySignal(INSTRUMENT, 50000);
    buy.set("_m", "position", "aboveBar", "shape", "arrowUp");
    expect(buy.instrument).toBe(INSTRUMENT);
    expect(buy.price).toBe(50000);
    const meta = buy.get<Map<string, unknown>>("_m");
    expect(meta!.get("position")).toBe("aboveBar");

    const signals: StrategySignal[] = [];
    strategy.onSignal((s) => signals.push(s));
    strategy.testEmitSignal(buy);

    expect(signals).toHaveLength(1);
    const received = signals[0] as BuySignal;
    expect(received.get<Map<string, unknown>>("_m")!.get("shape")).toBe(
      "arrowUp",
    );
  });

  it("createSellSignal with metadata", () => {
    setUp();
    const sell = strategy.testCreateSellSignal(INSTRUMENT, 60000);
    sell.set("reason", "stop-loss");
    expect(sell.instrument).toBe(INSTRUMENT);
    expect(sell.get<string>("reason")).toBe("stop-loss");
  });

  it("onSignal unsubscribe works", () => {
    setUp();
    const signals: StrategySignal[] = [];
    const unsub = strategy.onSignal((s) => signals.push(s));

    strategy.testEmitBuy(INSTRUMENT, 50000);
    expect(signals).toHaveLength(1);

    unsub();
    strategy.testEmitBuy(INSTRUMENT, 51000);
    expect(signals).toHaveLength(1); // still 1, unsubscribed
  });
});
