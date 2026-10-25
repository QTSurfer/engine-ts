import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { StrategyYield } from "../../src/event/yield/StrategyYield";
import type { ExecutionResult } from "../../src/execution/ExecutionResult";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import { ExecutionStatus } from "../../src/execution/ExecutionStatus";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import type { FeeContext, FeeModel } from "../../src/execution/simulation/FeeModel";
import { BarRangeSlippage } from "../../src/execution/simulation/SlippageModel";
import { NextBarOpenFill } from "../../src/execution/simulation/FillPolicy";

class TestStrategy extends AbstractTickerStrategy {
  constructor() {
    super("Test");
  }
  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}
}

const config: BacktestConfig = {
  initialFunding: 10000,
  feeRate: 0.001,
  currency: "USDT",
};

describe("BacktestExecutionPipeline", () => {
  it("starts IDLE with initial balance", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(pipeline.getBalance()).toBe(10000);
  });

  it("transitions to EXECUTING on buy", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config);
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 50000));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(pipeline.getBalance()).toBe(0);
  });

  it("ignores buy when already executing", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config);
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 50000));
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 60000));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("ignores sell when IDLE", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config);
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 50000));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(pipeline.getBalance()).toBe(10000);
  });

  it("completes buy→sell cycle with profit", () => {
    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onYield(y) { yields.push(y); },
    });

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(yields).toHaveLength(1);

    const y = yields[0];
    expect(y.instrument).toBe("BTC/USDT");
    expect(y.input).toBe(10000);
    // Canonical both-side fees (FeeLeg.RECEIVED): buy fee in base → 100 base
    // gross, base fee 0.1, net base 99.9. Sell @110 → gross 10989, quote fee
    // 10989*0.001 = 10.989, net 10978.011.
    expect(y.output).toBeCloseTo(10978.011, 3);
    expect(y.getYield()).toBeCloseTo(978.011, 3);
    expect(y.getYieldPercent()).toBeCloseTo(9.78011, 4);
  });

  it("completes buy→sell cycle with loss", () => {
    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onYield(y) { yields.push(y); },
    });

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 90));

    const y = yields[0];
    expect(y.getYield()).toBeLessThan(0);
    // Both-side fees: net base 99.9 sold @90 → gross 8991, quote fee 8.991,
    // net 8982.009.
    expect(y.output).toBeCloseTo(8982.009, 3);
  });

  it("supports multiple buy→sell cycles", () => {
    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onYield(y) { yields.push(y); },
    });

    // Cycle 1: buy@100, sell@110
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    // Cycle 2: buy at new balance price
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 120));

    expect(yields).toHaveLength(2);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(pipeline.getBalance()).toBeGreaterThan(0);
  });

  it("fires onFilledBuy and onFilledSell callbacks", () => {
    const strategy = new TestStrategy();
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell(r) { sells.push(r); },
      onYield() {},
    });

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    expect(buys).toHaveLength(1);
    expect(sells).toHaveLength(1);
    expect(buys[0].price).toBe(100);
    expect(sells[0].price).toBe(110);
    expect(sells[0].feeAmount).toBeGreaterThan(0);
  });

  it("updates strategy stats on yield", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config);

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    expect(strategy.stats.getTotalYields()).toBe(1);
    expect(strategy.stats.getTotalProfitYields()).toBe(1);
  });
});

describe("BacktestExecutionPipeline — simulation options (Phase 1)", () => {
  it("charges the buy fee in BASE at feeRateBuy (FeeLeg.RECEIVED)", () => {
    const strategy = new TestStrategy();
    const buys: ExecutionResult[] = [];
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRateBuy: 0.002 },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    // RECEIVED: cash 10000 buys 100 base gross; the 0.2% fee lands in BASE —
    // quote-equiv 20 → base fee 20/100 = 0.2. The position holds net base 99.8.
    expect(buys).toHaveLength(1);
    expect(buys[0].feeAmount).toBeCloseTo(0.2, 6);
    expect(buys[0].counterAmount).toBeCloseTo(10000, 6);
    expect(buys[0].baseAmount).toBeCloseTo(100, 6);
    expect(buys[0].getNetBaseAmount()).toBeCloseTo(99.8, 6);
    expect(pipeline.getBalance()).toBe(0);
  });

  it("applies feeRateSell override on sell", () => {
    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRateSell: 0.005 },
      {
        onFilledBuy() {},
        onFilledSell() {},
        onYield(y) { yields.push(y); },
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    // RECEIVED: buy fee 0.1% in base → net base 99.9. Sell @110 → gross 10989,
    // quote fee 10989*0.005 = 54.945, net 10934.055, yield 934.055.
    expect(yields[0].output).toBeCloseTo(10934.055, 6);
    expect(yields[0].getYield()).toBeCloseTo(934.055, 6);
  });

  it("applies fixed bps slippage adversely on buy", () => {
    const strategy = new TestStrategy();
    const buys: ExecutionResult[] = [];
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0, slippageBps: 100 },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    // 100 bps = 1% → effectivePrice = 101, baseAmount = 10000/101
    expect(buys[0].price).toBeCloseTo(101, 6);
    expect(buys[0].baseAmount).toBeCloseTo(10000 / 101, 6);
  });

  it("applies fixed bps slippage adversely on sell", () => {
    const strategy = new TestStrategy();
    const sells: ExecutionResult[] = [];
    const pipeline = new BacktestExecutionPipeline(
      // isolate sell slippage by feeding buy through zero-slippage config first
      strategy,
      { ...config, feeRate: 0, slippageBps: 100 },
      {
        onFilledBuy() {},
        onFilledSell(r) { sells.push(r); },
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    // sell effectivePrice = 110 * 0.99 = 108.9
    expect(sells[0].price).toBeCloseTo(108.9, 6);
  });

  it("closes the whole position whatever the sellPercent, as the Java engine's long pipeline", () => {
    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0 },
      {
        onFilledBuy() {},
        onFilledSell() {},
        onYield(y) { yields.push(y); },
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 120).setSellPercent(50));

    // sold all 100 units @ 120 → 12000 cash in; invested basis = 10000 → yield 2000
    expect(yields).toHaveLength(1);
    expect(yields[0].input).toBeCloseTo(10000, 6);
    expect(yields[0].output).toBeCloseTo(12000, 6);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(pipeline.getBalance()).toBeCloseTo(12000, 6);

    // nothing is left for a second sell
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 120));
    expect(yields).toHaveLength(1);
  });

  it("respects buyPercent for a partial entry", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...config,
      feeRate: 0,
      buyPercent: 50,
    });

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    // 50% of 10000 spent → 50 base units bought, 5000 cash residual
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(pipeline.getBalance()).toBeCloseTo(5000, 6);

    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));
    // sell 50 @ 110 = 5500, balance = 5000 + 5500 = 10500
    expect(pipeline.getBalance()).toBeCloseTo(10500, 6);
  });
});

describe("BacktestExecutionPipeline — pluggable models (Phase 2a)", () => {
  it("uses a custom FeeModel when supplied", () => {
    const calls: FeeContext[] = [];
    const model: FeeModel = {
      compute(ctx) {
        calls.push(ctx);
        // flat 3 units regardless of side / size
        return 3;
      },
    };

    const strategy = new TestStrategy();
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeModel: model },
      {
        onFilledBuy() {},
        onFilledSell() {},
        onYield(y) { yields.push(y); },
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    expect(calls).toHaveLength(2);
    expect(calls[0].side).toBe("buy");
    expect(calls[1].side).toBe("sell");
    // output = gross - fee = 11000 - 3 = 10997 (net after custom sell fee)
    // but note: buy fee also deducted from entry → baseAmount = (10000-3)/100 = 99.97
    // gross on sell = 99.97 * 110 ≈ 10996.7, net ≈ 10993.7
    expect(yields[0].output).toBeCloseTo(9997 * 1.1 - 3, 5);
  });

  it("uses a custom SlippageModel when supplied", () => {
    const sells: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    // Custom: constant +2 on buy, -2 on sell — independent of ticker.
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      {
        ...config,
        feeRate: 0,
        slippageModel: {
          adjust: ({ side, signalPrice }) =>
            side === "buy" ? signalPrice + 2 : signalPrice - 2,
        },
      },
      {
        onFilledBuy() {},
        onFilledSell(r) { sells.push(r); },
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));

    // Buy effective price 102 → baseAmount = 10000/102 ≈ 98.0392
    // Sell effective price 108 → gross ≈ 98.0392 * 108 ≈ 10588.23
    expect(sells[0].price).toBe(108);
    expect(sells[0].baseAmount).toBeCloseTo(10000 / 102, 6);
    expect(sells[0].counterAmount).toBeCloseTo((10000 / 102) * 108, 6);
  });

  it("feeds onTicker into a bar-range slippage model", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      {
        ...config,
        feeRate: 0,
        slippageModel: new BarRangeSlippage(1),
      },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    const bar: Ticker = {
      instrument: "BTC/USDT",
      open: 100,
      high: 110,
      low: 95,
      last: 108,
      bid: null,
      bidSize: null,
      ask: null,
      askSize: null,
      volume: null,
      quoteVolume: null,
      vwap: null,
      percentageChange: null,
      timestamp: 0,
    };

    pipeline.onTicker(bar);
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    // bias 1 → fill at bar high (110)
    expect(buys[0].price).toBe(110);
  });

  it("leaves slippage at signal price when onTicker has not been called", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      {
        ...config,
        feeRate: 0,
        slippageModel: new BarRangeSlippage(1),
      },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    // No pipeline.onTicker() call → BarRangeSlippage has no bar to bound against
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    expect(buys[0].price).toBe(100);
  });
});

describe("BacktestExecutionPipeline — FillPolicy (Phase 2b)", () => {
  function bar(open: number, ts = 0): Ticker {
    return {
      instrument: "BTC/USDT",
      open,
      high: null,
      low: null,
      last: null,
      bid: null,
      bidSize: null,
      ask: null,
      askSize: null,
      volume: null,
      quoteVolume: null,
      vwap: null,
      percentageChange: null,
      timestamp: ts,
    };
  }

  it("defers a signal until the next onTicker when FillPolicy is NextBarOpenFill", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0, fillPolicy: new NextBarOpenFill() },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    // Signal emitted on bar closing at 100 — must NOT fill immediately.
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(buys).toHaveLength(0);

    // Next bar opens at 102 → the queued buy fills here.
    pipeline.onTicker(bar(102));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(102);
  });

  it("runs a full buy→sell cycle across two deferred fills", () => {
    const yields: StrategyYield[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0, fillPolicy: new NextBarOpenFill() },
      {
        onFilledBuy() {},
        onFilledSell() {},
        onYield(y) { yields.push(y); },
      },
    );

    // Buy signal; next bar opens at 100 → fill at 100, 100 base bought.
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.onTicker(bar(100));
    expect(pipeline.getBalance()).toBe(0);

    // Sell signal; next bar opens at 120 → fill at 120, yield = 2000.
    pipeline.handle(new SellSignal("Test", "BTC/USDT", 110));
    pipeline.onTicker(bar(120));
    expect(yields).toHaveLength(1);
    expect(yields[0].output).toBeCloseTo(12000, 6);
    expect(yields[0].getYield()).toBeCloseTo(2000, 6);
  });

  it("applies slippage on top of the policy-resolved price", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      {
        ...config,
        feeRate: 0,
        fillPolicy: new NextBarOpenFill(),
        slippageBps: 100, // 1% adverse
      },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.onTicker(bar(100));

    // Policy resolves to 100 (open); buy slippage 1% → 101.
    expect(buys[0].price).toBeCloseTo(101, 6);
  });

  it("falls back to signal price when the deferred bar lacks an open", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0, fillPolicy: new NextBarOpenFill() },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));

    // bar with open=null → NextBarOpenFill returns signal.price as fallback
    const b: Ticker = {
      instrument: "BTC/USDT",
      open: null,
      high: null,
      low: null,
      last: null,
      bid: null,
      bidSize: null,
      ask: null,
      askSize: null,
      volume: null,
      quoteVolume: null,
      vwap: null,
      percentageChange: null,
      timestamp: 0,
    };
    pipeline.onTicker(b);
    expect(buys[0].price).toBe(100);
  });

  it("ignores an extra buy that arrives between deferred emission and fill", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, feeRate: 0, fillPolicy: new NextBarOpenFill() },
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("Test", "BTC/USDT", 100));
    pipeline.handle(new BuySignal("Test", "BTC/USDT", 101));

    // Both queued. On the next bar, the first flips status to EXECUTING and
    // the second is silently dropped (state machine gate in processBuy).
    pipeline.onTicker(bar(100));
    expect(buys).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });
});
