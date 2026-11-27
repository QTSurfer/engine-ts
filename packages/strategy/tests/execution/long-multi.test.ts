import { describe, expect, it } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { MarketHintSignal } from "../../src/event/signal/MarketHintSignal";
import type { StrategyYield } from "../../src/event/yield/StrategyYield";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import { ExecutionMode } from "../../src/execution/ExecutionMode";
import { ExecutionStatus } from "../../src/execution/ExecutionStatus";
import { FeeLeg } from "../../src/execution/FeeLeg";
import type { Fill, IgnoredReason } from "../../src/execution/SessionOutput";
import { makeTicker } from "../helpers/tickers";

/**
 * A strategy in `LONG_MULTI` (`setMultiEntryEnabled(true)`) scales in: every buy while long adds an
 * entry to the one position, sized from the cash that is left, and a sell sells its `sellPercent`
 * of what the position holds. The yield is one, when the position is closed. A strategy in `LONG`
 * keeps its single entry and its all-in sell.
 */

const BTC = "BTC/USDT";

class TestStrategy extends AbstractTickerStrategy {
  constructor(multi: boolean) {
    super("Test");
    this.setMultiEntryEnabled(multi);
  }

  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}
}

function config(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return { initialFunding: 1000, feeRate: 0, currency: "USDT", ...overrides };
}

function tick(last: number, timestamp = 0): Ticker {
  return makeTicker(last, timestamp, BTC);
}

/** A pipeline with its strategy and everything it reports. */
function setUp(multi: boolean, overrides: Partial<BacktestConfig> = {}) {
  const yields: StrategyYield[] = [];
  const fills: Fill[] = [];
  const ignored: { signal: MarketHintSignal; reason: IgnoredReason }[] = [];
  const strategy = new TestStrategy(multi);
  const pipeline = new BacktestExecutionPipeline(strategy, config(overrides), {
    onFilledBuy() {},
    onFilledSell() {},
    onFill(fill) {
      fills.push(fill);
    },
    onIgnored(signal, reason) {
      ignored.push({ signal, reason });
    },
    onYield(y) {
      yields.push(y);
    },
  });
  return { strategy, pipeline, yields, fills, ignored };
}

const buy = (price: number) => new BuySignal("T", BTC, price);
const sell = (price: number) => new SellSignal("T", BTC, price);

describe("a position that scales in (LONG_MULTI)", () => {
  it("adds a second buy to the position, sized from the funds and not from the cash that is left", () => {
    const { pipeline, fills, ignored } = setUp(true, { buyPercent: 25 });

    pipeline.handle(buy(100)); // 25% of the 1000: 250, 2.5 base
    pipeline.handle(buy(125)); // 25% of the 1000 again, not of the 750 left: 250, 2 base

    expect(ignored).toEqual([]);
    expect(fills.map((f) => [f.side, f.price, f.baseAmount, f.counterAmount])).toEqual([
      ["buy", 100, 2.5, 250],
      ["buy", 125, 2, 250],
    ]);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(pipeline.getBalance()).toBe(500);
  });

  it("two entries of half the funds each, at 100 and at 105", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });

    pipeline.handle(buy(100));
    pipeline.handle(buy(105));

    expect(fills.map((f) => f.counterAmount)).toEqual([500, 500]);
    expect(fills[0]?.baseAmount).toBe(5);
    expect(fills[1]?.baseAmount).toBeCloseTo(500 / 105, 12); // 4.7619...
  });

  it("never spends more than the cash there is: a share that does not fit takes what is left", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 60 });

    pipeline.handle(buy(100)); // 600
    pipeline.handle(buy(100)); // 60% of 1000 is 600, and 400 is what is left

    expect(fills.map((f) => f.counterAmount)).toEqual([600, 400]);
    expect(pipeline.getBalance()).toBe(0);
  });

  it("a second buy with nothing left to spend is dropped as no-funds", () => {
    const { pipeline, ignored } = setUp(true); // buyPercent 100: the first buy takes the cash

    pipeline.handle(buy(100));
    pipeline.handle(buy(110));

    expect(ignored.map((i) => i.reason)).toEqual(["no-funds"]);
    expect(pipeline.getBalance()).toBe(0);
  });

  it("the funds an entry is sized from are the funding and what closed positions made", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100)); // 500
    pipeline.handle(sell(120)); // 5 base for 600: the run holds 1100 now

    pipeline.handle(buy(100)); // 50% of 1100: 550
    pipeline.handle(buy(100)); // 50% of the same 1100: 550, which is all the cash that is left

    expect(fills.filter((f) => f.side === "buy").map((f) => f.counterAmount)).toEqual([500, 550, 550]);
  });

  it("and what closed positions lost", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100)); // 500
    pipeline.handle(sell(80)); // 5 base for 400: the run holds 900 now

    pipeline.handle(buy(100)); // 450
    pipeline.handle(buy(100)); // 50% of 900: 450

    expect(fills.filter((f) => f.side === "buy").map((f) => f.counterAmount)).toEqual([500, 450, 450]);
  });

  it("the sell that closes it sells the whole position and yields once, for all its entries", () => {
    const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
    pipeline.handle(buy(100));
    pipeline.handle(buy(125));

    pipeline.handle(sell(130)); // 4.5 base at 130 = 585, against the 500 the two entries cost

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 4.5, counterAmount: 585 });
    expect(yields).toHaveLength(1);
    expect(yields[0]?.input).toBe(500);
    expect(yields[0]?.output).toBe(585);
    expect(yields[0]?.getYield()).toBe(85);
    expect(pipeline.getBalance()).toBe(500 + 585);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("a partial sell leaves the rest open, and the yield comes with the sell that closes it", () => {
    const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
    pipeline.handle(buy(100));
    pipeline.handle(buy(125));

    pipeline.handle(sell(120).setSellPercent(50)); // half of 4.5 base: 2.25 at 120 = 270

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 2.25, counterAmount: 270 });
    expect(yields).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(pipeline.getBalance()).toBe(500 + 270);

    pipeline.handle(sell(130)); // the 2.25 that are left: 292.5

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 2.25, counterAmount: 292.5 });
    expect(yields).toHaveLength(1);
    expect(yields[0]?.input).toBe(500);
    expect(yields[0]?.output).toBe(562.5); // 270 + 292.5
    expect(pipeline.getBalance()).toBe(500 + 562.5);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("a buy after a partial sell grows what is left of the position", () => {
    const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
    pipeline.handle(buy(100)); // 250: 2.5 base
    pipeline.handle(sell(110).setSellPercent(40)); // 1 base at 110 = 110; 1.5 base left
    pipeline.handle(buy(100)); // 25% of the funds again: 250, 2.5 base; 4 base held

    pipeline.handle(sell(110)); // 4 at 110 = 440

    expect(fills.map((f) => f.side)).toEqual(["buy", "sell", "buy", "sell"]);
    expect(fills.at(-1)?.baseAmount).toBeCloseTo(4, 10);
    expect(yields).toHaveLength(1);
    expect(yields[0]?.input).toBe(500); // 250 + 250
    expect(yields[0]?.output).toBeCloseTo(550, 10); // 110 + 440
  });

  it("what a partial sell brought back is not funds to size from until the position closes", () => {
    const { pipeline, fills, ignored } = setUp(true, { buyPercent: 60 });
    pipeline.handle(buy(100)); // 600: 6 base, 400 left
    pipeline.handle(sell(110).setSellPercent(50)); // 3 base for 330: 730 of cash now

    pipeline.handle(buy(100)); // 60% of the 1000 funds is 600, and 1000 less the 600 locked is 400

    expect(fills.filter((f) => f.side === "buy").map((f) => f.counterAmount)).toEqual([600, 400]);
    expect(ignored).toEqual([]);
    expect(pipeline.getBalance()).toBe(730 - 400);
  });

  it("and with everything locked, a buy is dropped as no-funds even with cash back from a partial sell", () => {
    const { pipeline, ignored, fills } = setUp(true); // buyPercent 100: all-in
    pipeline.handle(buy(100)); // 1000: 10 base
    pipeline.handle(sell(110).setSellPercent(50)); // 5 base for 550

    pipeline.handle(buy(100));

    expect(ignored.map((i) => i.reason)).toEqual(["no-funds"]);
    expect(fills.filter((f) => f.side === "buy")).toHaveLength(1);
  });

  it.each([
    [100, 0.001],
    [37.3, 0.0004],
    [0.0071, 0.002],
    [64_250.5, 0.00075],
  ])("an all-in QUOTE-fee entry at %d (fee %d) leaves nothing for a second one, not dust", (price, feeRate) => {
    const { pipeline, ignored, fills } = setUp(true, { feeRate, feeLeg: FeeLeg.QUOTE });
    pipeline.handle(buy(price));

    pipeline.handle(buy(price));

    expect(ignored.map((i) => i.reason)).toEqual(["no-funds"]);
    expect(fills.filter((f) => f.side === "buy")).toHaveLength(1);
  });

  it("QUOTE fees count in what an entry locks: a second entry that does not fit leaves the cash at zero", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 60, feeRate: 0.001, feeLeg: FeeLeg.QUOTE });
    pipeline.handle(buy(100)); // 60% of the funds, fee included: 600 leave the cash

    pipeline.handle(buy(100)); // 60% is 600, and 400 is what the first left unlocked, fee included

    const spent = fills.filter((f) => f.side === "buy").map((f) => f.counterAmount + f.fee);
    expect(spent[0]).toBeCloseTo(600, 9);
    expect(spent[1]).toBeCloseTo(400, 9);
    expect(pipeline.getBalance()).toBeGreaterThanOrEqual(-1e-9);
    expect(pipeline.getBalance()).toBeLessThan(1e-9);
  });

  it("a sell of a share of nothing is dropped as zero-size and leaves the position as it was", () => {
    const { pipeline, yields, ignored } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100));

    pipeline.handle(sell(110).setSellPercent(0));

    expect(ignored.map((i) => i.reason)).toEqual(["zero-size"]);
    expect(yields).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("closing the position leaves it free to open another", () => {
    const { pipeline, yields } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100)); // 500
    pipeline.handle(buy(100)); // 500
    pipeline.handle(sell(110)); // 1100: the run holds 1100 now

    pipeline.handle(buy(100)); // 550
    pipeline.handle(sell(120));

    expect(yields).toHaveLength(2);
    // The second round trip knows nothing of the first: what it cost and what it brought are its own
    const second = yields[1]!;
    expect(second.input).toBe(550);
    expect(second.output).toBeCloseTo(660, 10);
  });

  it.each([
    ["RECEIVED", FeeLeg.RECEIVED],
    ["QUOTE", FeeLeg.QUOTE],
  ])("%s fees: the cash that ends up is the funding plus the yield", (_name, feeLeg) => {
    const { pipeline, yields } = setUp(true, { buyPercent: 25, feeRate: 0.001, feeLeg });
    pipeline.handle(buy(100));
    pipeline.handle(buy(120));
    pipeline.handle(sell(130).setSellPercent(30));
    pipeline.handle(buy(125));
    pipeline.handle(sell(140));

    expect(yields).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(pipeline.getBalance()).toBeCloseTo(1000 + yields[0]!.getYield(), 9);
  });

  it("RECEIVED fees: the position holds the base net of what every entry paid", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 25, feeRate: 0.001 });
    pipeline.handle(buy(100)); // 250 -> 2.5 base, fee 0.0025 base
    pipeline.handle(buy(125)); // 250 -> 2 base, fee 0.002 base

    pipeline.handle(sell(130));

    expect(fills.at(-1)?.baseAmount).toBeCloseTo(4.5 - 0.0025 - 0.002, 12);
  });

  describe("the protective stop", () => {
    it("an entry that asks for none leaves the stop of the first one covering the whole position", () => {
      const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
      pipeline.handle(buy(100).setStopPrice(90));
      pipeline.onTicker(tick(100));
      pipeline.handle(buy(125)); // no stop of its own

      pipeline.onTicker(tick(89));

      expect(fills.at(-1)).toMatchObject({ side: "sell", price: 90, baseAmount: 4.5 }); // both entries
      expect(yields).toHaveLength(1);
      expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    });

    it("an entry that asks for one re-places it: a stop moved up fires at the new level", () => {
      const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
      pipeline.handle(buy(100).setStopPrice(90));
      pipeline.onTicker(tick(100));
      pipeline.handle(buy(125).setStopPrice(110)); // the stop moves up to 110

      pipeline.onTicker(tick(111)); // above the new stop: nothing
      expect(yields).toHaveLength(0);
      pipeline.onTicker(tick(105));

      expect(fills.at(-1)).toMatchObject({ side: "sell", price: 110, baseAmount: 4.5 });
      expect(yields).toHaveLength(1);
    });

    it("an entry that asks for one re-places it: the old stop does not fire where the new one would not", () => {
      const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
      pipeline.handle(buy(100).setStopPrice(95));
      pipeline.onTicker(tick(100));
      pipeline.handle(buy(110).setStopPrice(85)); // the stop moves down to 85

      pipeline.onTicker(tick(90)); // below the old stop (95), above the new one
      expect(yields).toHaveLength(0);
      expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
      pipeline.onTicker(tick(84));

      expect(fills.at(-1)).toMatchObject({ side: "sell", price: 85 });
      expect(yields).toHaveLength(1);
    });

    it("only one stop is left to fire: it fills once, and nothing stale is left after the close", () => {
      const { pipeline, fills } = setUp(true, { buyPercent: 25 });
      pipeline.handle(buy(100).setStopPrice(90));
      pipeline.onTicker(tick(100));
      pipeline.handle(buy(110).setStopPrice(95));

      pipeline.onTicker(tick(94));
      pipeline.onTicker(tick(80));

      expect(fills.filter((f) => f.side === "sell")).toHaveLength(1);
    });

    it("a partial sell leaves the stop protecting what is left", () => {
      const { pipeline, yields, fills } = setUp(true, { buyPercent: 25 });
      pipeline.handle(buy(100).setStopPrice(90));
      pipeline.onTicker(tick(100));
      pipeline.handle(sell(120).setSellPercent(50)); // 1.25 of the 2.5 base

      pipeline.onTicker(tick(89));

      expect(fills.at(-1)).toMatchObject({ side: "sell", price: 90, baseAmount: 1.25 });
      expect(yields).toHaveLength(1);
    });
  });
});

describe("a signal that asks for its own size", () => {
  it("each entry of a LONG_MULTI position takes the share it asks for: 10, 20, then everything left", () => {
    const { pipeline, fills, ignored } = setUp(true); // buyPercent 100 is the run's

    pipeline.handle(buy(100).setSizePercent(10)); // 10% of the 1000
    pipeline.handle(buy(100).setSizePercent(20)); // 20% of the 1000, not of what is left
    pipeline.handle(buy(100).setSizePercent(100)); // all the funds, which is the 700 that is left

    expect(ignored).toEqual([]);
    expect(fills.map((f) => f.baseAmount)).toEqual([1, 2, 7]);
    expect(fills.map((f) => f.counterAmount)).toEqual([100, 200, 700]);
    expect(pipeline.getBalance()).toBe(0);
  });

  it("replaces the run's share for that signal only", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });

    pipeline.handle(buy(100).setSizePercent(10)); // 100: 1 base
    pipeline.handle(buy(100)); // the run's 50% of the funds: 500: 5 base

    expect(fills.map((f) => f.baseAmount)).toEqual([1, 5]);
  });

  it("is valid in LONG, where it sizes the one entry", () => {
    const { pipeline, fills } = setUp(false);

    pipeline.handle(buy(100).setSizePercent(25));

    expect(fills.map((f) => f.baseAmount)).toEqual([2.5]);
  });

  it("a size of 0 buys nothing and leaves the cash as it was", () => {
    const { pipeline, fills, ignored } = setUp(true);

    pipeline.handle(buy(100).setSizePercent(0));

    expect(ignored.map((i) => i.reason)).toEqual(["zero-size"]);
    expect(fills).toEqual([]);
    expect(pipeline.getBalance()).toBe(1000);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("a size of 0 on a further entry leaves the position as it was", () => {
    const { pipeline, fills, ignored } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100));

    pipeline.handle(buy(100).setSizePercent(0));

    expect(ignored.map((i) => i.reason)).toEqual(["zero-size"]);
    expect(fills).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("on a sell it is the share of the open position: a size of 40 sells 2 of 5", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100)); // 500: 5 base

    pipeline.handle(sell(100).setSizePercent(40));

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 2 });
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("setSellPercent is the same size for a sell", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100));

    pipeline.handle(sell(100).setSellPercent(40));

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 2 });
  });

  it("a position scaled in with sizes closes into one yield", () => {
    const { pipeline, yields } = setUp(true);
    pipeline.handle(buy(100).setSizePercent(10)); // 100
    pipeline.handle(buy(100).setSizePercent(20)); // 200

    pipeline.handle(sell(110)); // 3 base at 110 = 330

    expect(yields).toHaveLength(1);
    expect(yields[0]?.input).toBe(300);
    expect(yields[0]?.output).toBeCloseTo(330, 10);
  });
});

describe("a signal that asks for a share of the most it can take", () => {
  it("with nothing configured, 10, 20 and 100 of what is left take 100, 180 and 720", () => {
    const { pipeline, fills, ignored } = setUp(true); // buyPercent 100: the whole cash left is the most

    pipeline.handle(buy(100).setMaxPercent(10)); // 10% of the 1000
    pipeline.handle(buy(100).setMaxPercent(20)); // 20% of the 900 that is left, not of the funds
    pipeline.handle(buy(100).setMaxPercent(100)); // all of the 720 that is left

    expect(ignored).toEqual([]);
    expect(fills.map((f) => f.counterAmount)).toEqual([100, expect.closeTo(180, 10), expect.closeTo(720, 10)]);
    expect(fills.map((f) => f.baseAmount)).toEqual([1, expect.closeTo(1.8, 10), expect.closeTo(7.2, 10)]);
  });

  it("the configured share of the funds is a ceiling it never passes: 10, 20 and 100 of 50% take 50, 100 and 500", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });

    pipeline.handle(buy(100).setMaxPercent(10)); // 10% of 500
    pipeline.handle(buy(100).setMaxPercent(20)); // 20% of 500: the most is 50% of the funds, whatever is left
    pipeline.handle(buy(100).setMaxPercent(100)); // all of the 500

    expect(fills.map((f) => f.baseAmount)).toEqual([0.5, 1, 5]);
  });

  it("a size in funds takes the place of the ceiling, a share of the maximum does not", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });

    pipeline.handle(buy(100).setSizePercent(80)); // 80% of the funds, whatever the run is set to
    pipeline.handle(buy(100).setMaxPercent(100)); // 50% of the funds is the most, and 200 is what is left

    expect(fills.map((f) => f.counterAmount)).toEqual([800, 200]);
  });

  it("is valid in LONG, where it takes a share of the one entry's maximum", () => {
    const { pipeline, fills } = setUp(false, { buyPercent: 50 });

    pipeline.handle(buy(100).setMaxPercent(40)); // 40% of the 500

    expect(fills.map((f) => f.baseAmount)).toEqual([2]);
  });

  it("a share of 0 buys nothing", () => {
    const { pipeline, fills, ignored } = setUp(true);

    pipeline.handle(buy(100).setMaxPercent(0));

    expect(ignored.map((i) => i.reason)).toEqual(["zero-size"]);
    expect(fills).toEqual([]);
    expect(pipeline.getBalance()).toBe(1000);
  });

  it("with everything locked there is nothing to take a share of: no-funds", () => {
    const { pipeline, ignored } = setUp(true);
    pipeline.handle(buy(100).setMaxPercent(100)); // all of it

    pipeline.handle(buy(100).setMaxPercent(50));

    expect(ignored.map((i) => i.reason)).toEqual(["no-funds"]);
  });

  it("on a sell it is the share of the open position: 40 of 5 sells 2", () => {
    const { pipeline, fills } = setUp(true, { buyPercent: 50 });
    pipeline.handle(buy(100)); // 500: 5 base

    pipeline.handle(sell(100).setMaxPercent(40));

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 2 });
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });
});

describe("a position that does not scale in (LONG)", () => {
  it("a second buy while long is dropped as already-long", () => {
    const { pipeline, ignored, fills } = setUp(false, { buyPercent: 50 });

    pipeline.handle(buy(100));
    pipeline.handle(buy(125));

    expect(ignored.map((i) => i.reason)).toEqual(["already-long"]);
    expect(fills).toHaveLength(1);
  });

  it("a sell sells the whole position, whatever its sellPercent says", () => {
    const { pipeline, yields, fills } = setUp(false, { buyPercent: 50 });
    pipeline.handle(buy(100));

    pipeline.handle(sell(110).setSellPercent(50));

    expect(fills.at(-1)).toMatchObject({ side: "sell", baseAmount: 5 });
    expect(yields).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("setExecutionMode(LONG_MULTI) is the same as setMultiEntryEnabled(true)", () => {
    const strategy = new TestStrategy(false);
    strategy.setExecutionMode(ExecutionMode.LONG_MULTI);
    const ignored: IgnoredReason[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config({ buyPercent: 50 }), {
      onFilledBuy() {},
      onFilledSell() {},
      onIgnored(_signal, reason) {
        ignored.push(reason);
      },
      onYield() {},
    });

    pipeline.handle(buy(100));
    pipeline.handle(buy(125));

    expect(ignored).toEqual([]);
  });
});

describe("a run of a strategy that scales in", () => {
  class ScalingStrategy extends AbstractTickerStrategy {
    private seen = 0;

    constructor() {
      super("Scaling");
      this.setMultiEntryEnabled(true);
    }

    override update(ticker: Ticker): void {
      super.update(ticker);
      this.seen++;
      const price = ticker.last ?? 0;
      if (this.seen === 1 || this.seen === 2) this.emitBuy(ticker.instrument, price);
      if (this.seen === 4) this.emitSell(ticker.instrument, price);
    }
  }

  const ticks = [100, 125, 130, 130].map((price, i) => tick(price, 1_700_000_000_000 + i * 60_000));

  it("buys twice, sells once, and drops nothing", () => {
    const result = BacktestRunner.run(new ScalingStrategy(), ticks, config({ buyPercent: 25 }));

    expect(result.session.fills.map((f) => f.side)).toEqual(["buy", "buy", "sell"]);
    expect(result.session.markers.filter((m) => m.ignored !== undefined)).toEqual([]);
    expect(result.yields).toHaveLength(1);
    expect(result.metrics.totalTrades).toBe(1);
    expect(result.finalEquity).toBe(1000 + 85);
    expect(result.finalBalance).toBe(1085);
  });

  it("shows the position as one trade: the average entry and what the sell took", () => {
    const result = BacktestRunner.run(new ScalingStrategy(), ticks, config({ buyPercent: 25 }));

    expect(result.session.trades).toHaveLength(1);
    expect(result.session.trades[0]).toMatchObject({
      entryTime: ticks[0]?.timestamp, // the first entry
      entryPrice: 500 / 4.5, // 250 at 100 and 250 at 125: 4.5 base for 500
      exitTime: ticks[3]?.timestamp,
      exitPrice: 130,
      baseAmount: 4.5,
      input: 500,
      output: 585,
      pnl: 85,
    });
  });

  it("a position that is sold in two parts is still one trade: its exits are averaged", () => {
    class Partial extends ScalingStrategy {
      private bars = 0;

      override update(ticker: Ticker): void {
        super.update(ticker);
        this.bars++;
        if (this.bars === 3) {
          this.emitSignal(this.createSellSignal(ticker.instrument, ticker.last ?? 0).setSellPercent(50));
        }
      }
    }
    // Buys at 100 and 125 (4.5 base for 500); half sold at 120 (2.25 for 270), the rest at 130 (292.5)
    const partialTicks = [100, 125, 120, 130].map((price, i) => tick(price, 1_700_000_000_000 + i * 60_000));

    const result = BacktestRunner.run(new Partial(), partialTicks, config({ buyPercent: 25 }));

    expect(result.session.fills.map((f) => f.side)).toEqual(["buy", "buy", "sell", "sell"]);
    expect(result.yields).toHaveLength(1);
    expect(result.session.trades).toHaveLength(1);
    expect(result.session.trades[0]).toMatchObject({
      entryTime: partialTicks[0]?.timestamp,
      entryPrice: 500 / 4.5,
      exitTime: partialTicks[3]?.timestamp,
      exitPrice: 125, // 562.5 for 4.5 base
      baseAmount: 4.5,
      input: 500,
      output: 562.5,
      pnl: 62.5,
    });
  });

  it("a strategy that does not scale in keeps the one entry it had", () => {
    class Single extends ScalingStrategy {
      constructor() {
        super();
        this.setMultiEntryEnabled(false);
      }
    }

    const result = BacktestRunner.run(new Single(), ticks, config({ buyPercent: 50 }));

    expect(result.session.fills.map((f) => f.side)).toEqual(["buy", "sell"]);
    expect(result.session.markers.filter((m) => m.ignored?.reason === "already-long")).toHaveLength(1);
  });
});
