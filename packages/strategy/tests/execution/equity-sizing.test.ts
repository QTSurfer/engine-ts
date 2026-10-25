import { describe, it, expect } from "vitest";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { StrategyYield } from "../../src/event/yield/StrategyYield";
import type { ExecutionResult } from "../../src/execution/ExecutionResult";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";

/**
 * Entry sizing follows the account's current EQUITY (funding plus everything
 * realised so far), not the opening balance: a loss shrinks the next position
 * and a gain grows it. Zero fees keep the arithmetic exact.
 */

class TestStrategy extends AbstractTickerStrategy {
  constructor() {
    super("Test");
  }
  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}
}

const INSTRUMENT = "BTC/USDT";

function run(config: BacktestConfig, trips: ReadonlyArray<{ buy: number; sell: number }>) {
  const buys: ExecutionResult[] = [];
  const yields: StrategyYield[] = [];
  const pipeline = new BacktestExecutionPipeline(new TestStrategy(), config, {
    onFilledBuy(r) {
      buys.push(r);
    },
    onFilledSell() {},
    onYield(y) {
      yields.push(y);
    },
  });
  let ts = 1_700_000_000_000;
  for (const trip of trips) {
    const buy = new BuySignal("T", INSTRUMENT, trip.buy);
    buy.timestamp = ts++;
    pipeline.handle(buy);
    const sell = new SellSignal("T", INSTRUMENT, trip.sell);
    sell.timestamp = ts++;
    pipeline.handle(sell);
  }
  return { pipeline, buys, yields };
}

describe("BacktestExecutionPipeline — entry sizing follows equity", () => {
  it("sizes the second all-in entry from the equity after a winning first trade", () => {
    // funding 1000, all-in, zero fees.
    // Trip 1: buy @100 -> 1000/100 = 10 base; sell @110 -> 10*110 = 1100 (+10%).
    //         equity after trip 1 = 1000 + 100 = 1100.
    // Trip 2: buy @100.
    //   equity-sized  : 1100/100 = 11 base, counterAmount 1100  (expected)
    //   opening-sized : 1000/100 = 10 base, counterAmount 1000  (what a constant-funding sizer gives)
    // Sell @100 flat -> trip 2 yield input 1100, output 1100, final balance 1100.
    const { pipeline, buys, yields } = run(
      { initialFunding: 1000, feeRate: 0, currency: "USDT" },
      [
        { buy: 100, sell: 110 },
        { buy: 100, sell: 100 },
      ],
    );

    expect(yields).toHaveLength(2);
    expect(yields[0].input).toBeCloseTo(1000, 9);
    expect(yields[0].output).toBeCloseTo(1100, 9);

    expect(buys).toHaveLength(2);
    expect(buys[1].counterAmount).toBeCloseTo(1100, 9);
    expect(buys[1].baseAmount).toBeCloseTo(11, 9);

    expect(yields[1].input).toBeCloseTo(1100, 9);
    expect(yields[1].output).toBeCloseTo(1100, 9);
    expect(pipeline.getBalance()).toBeCloseTo(1100, 9);
  });

  it("sizes the second all-in entry from the equity after a losing first trade", () => {
    // funding 1000, all-in, zero fees.
    // Trip 1: buy @100 -> 10 base; sell @90 -> 10*90 = 900 (-10%).
    //         equity after trip 1 = 1000 - 100 = 900.
    // Trip 2: buy @100.
    //   equity-sized  : 900/100 = 9 base, counterAmount 900   (expected)
    //   opening-sized : 1000/100 = 10 base, counterAmount 1000 (would spend cash the account no longer has)
    // Sell @100 flat -> final balance 900.
    const { pipeline, buys, yields } = run(
      { initialFunding: 1000, feeRate: 0, currency: "USDT" },
      [
        { buy: 100, sell: 90 },
        { buy: 100, sell: 100 },
      ],
    );

    expect(yields).toHaveLength(2);
    expect(yields[0].output).toBeCloseTo(900, 9);

    expect(buys).toHaveLength(2);
    expect(buys[1].counterAmount).toBeCloseTo(900, 9);
    expect(buys[1].baseAmount).toBeCloseTo(9, 9);
    expect(pipeline.getBalance()).toBeCloseTo(900, 9);
  });

  it("applies a fractional buyPercent to the current equity, not to the opening balance", () => {
    // funding 1000, buyPercent 50, zero fees.
    // Trip 1: spend 500 -> 5 base @100; sell @110 -> 550. Cash = 500 (unspent) + 550 = 1050.
    // Trip 2: buy @100.
    //   equity-sized  : 50% of 1050 = 525 -> 5.25 base   (expected)
    //   opening-sized : 50% of 1000 = 500 -> 5 base
    const { buys } = run(
      { initialFunding: 1000, feeRate: 0, buyPercent: 50, currency: "USDT" },
      [
        { buy: 100, sell: 110 },
        { buy: 100, sell: 100 },
      ],
    );

    expect(buys).toHaveLength(2);
    expect(buys[1].counterAmount).toBeCloseTo(525, 9);
    expect(buys[1].baseAmount).toBeCloseTo(5.25, 9);
  });
});
