import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import { OrderKind } from "../../src/event/signal/MarketHintSignal";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import type {
  FeeContext,
  FeeModel,
} from "../../src/execution/simulation/FeeModel";
import { MakerTakerFeeModel } from "../../src/execution/simulation/FeeModel";

class TestStrategy extends AbstractTickerStrategy {
  constructor() { super("Test"); }
  protected override setupIndicators(_i: InstrumentGroupRTIndicator): void {}
}

function bar(partial: Partial<Ticker>): Ticker {
  return {
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
    ...partial,
  };
}

function spyingModel(): { model: FeeModel; calls: FeeContext[] } {
  const calls: FeeContext[] = [];
  const model: FeeModel = {
    compute(ctx) {
      calls.push(ctx);
      return 0;
    },
  };
  return { model, calls };
}

const baseConfig: BacktestConfig = {
  initialFunding: 10_000,
  feeRate: 0,
  currency: "USDT",
};

describe("Pipeline → FeeContext.liquidity routing (Phase 2e)", () => {
  it("tags a market fill as taker", () => {
    const { model, calls } = spyingModel();
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...baseConfig,
      feeModel: model,
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    expect(calls).toHaveLength(1);
    expect(calls[0].liquidity).toBe("taker");
  });

  it("tags a limit fill as maker", () => {
    const { model, calls } = spyingModel();
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...baseConfig,
      feeModel: model,
    });

    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 95).setOrderKind(OrderKind.limit),
    );
    pipeline.onTicker(bar({ last: 93 }));
    expect(calls).toHaveLength(1);
    expect(calls[0].liquidity).toBe("maker");
  });

  it("tags a stop-triggered fill as taker", () => {
    const { model, calls } = spyingModel();
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...baseConfig,
      feeModel: model,
    });

    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 105).setOrderKind(OrderKind.stop),
    );
    pipeline.onTicker(bar({ last: 108 }));
    expect(calls).toHaveLength(1);
    expect(calls[0].liquidity).toBe("taker");
  });

  it("tags a trailing-stop fill as taker", () => {
    const { model, calls } = spyingModel();
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...baseConfig,
      feeModel: model,
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailDistance(2),
    );
    pipeline.onTicker(bar({ last: 97 }));
    // calls[0] = buy (taker). calls[1] = trailing-stop sell (taker).
    expect(calls).toHaveLength(2);
    expect(calls[1].liquidity).toBe("taker");
  });

  it("end-to-end MakerTakerFeeModel charges the right rate per fill", () => {
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, {
      ...baseConfig,
      feeModel: new MakerTakerFeeModel(0.0002, 0.001), // 2 bps maker, 10 bps taker
    });

    // 1) market buy (taker) @ 100 → cash 10_000, taker fee = 10, net spend 9_990,
    //    baseAmount = 99.9
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));

    // 2) limit sell (maker) @ 120; triggers on the next tick whose last reaches 120.
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 120).setOrderKind(OrderKind.limit),
    );
    pipeline.onTicker(bar({ last: 122 }));

    // Sell fill: 99.9 base * 120 = 11_988 gross, maker fee 2 bps = 2.3976,
    // net 11_985.6024 → balance ≈ 11_985.60
    expect(pipeline.getBalance()).toBeCloseTo(11985.6024, 4);
  });
});
