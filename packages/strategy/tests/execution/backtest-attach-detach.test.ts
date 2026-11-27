import { describe, expect, it } from "vitest";
import { MarketDataSource, VenueType } from "@qtsurfer/core";
import type { Kline, Ticker } from "@qtsurfer/core";
import { AbstractKlineStrategy } from "../../src/AbstractKlineStrategy";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { InfoStrategySignal } from "../../src/event/signal/InfoStrategySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { StrategySignal } from "../../src/event/signal/StrategySignal";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import { BacktestRunner, type BacktestResult } from "../../src/execution/BacktestRunner";
import { StrategyContext } from "../../src/StrategyContext";
import { makeTicker } from "../helpers/tickers";

/**
 * A backtest tells the strategy about its source the way a live run does: `onAttach` once before
 * the first data point and `onDetach` once after the last, so a strategy that relies on the hooks
 * behaves the same in both.
 *
 * The hooks add calls around the replay and nothing inside it. The last group of tests holds that
 * line: a strategy that records the calls trades exactly like one that does not.
 */

const BTC = "BTC/USDT";
const ETH = "ETH/USDT";
const ATTACH_PRICE = 100;
const T0 = 1_700_000_000_000;
const MINUTE = 60_000;
const NO_FEES: BacktestConfig = { initialFunding: 1000, feeRate: 0, currency: "USDT" };

// --- What a strategy was told ----------------------------------------------------------------

/** Everything a strategy was told, in the order it was told. */
class Calls {
  readonly order: string[] = [];
  readonly attached: StrategyContext[] = [];
  readonly detached: StrategyContext[] = [];

  attach(context: StrategyContext): void {
    this.order.push("attach");
    this.attached.push(context);
  }

  update(): void {
    this.order.push("update");
  }

  detach(context: StrategyContext): void {
    this.order.push("detach");
    this.detached.push(context);
  }

  count(call: string): number {
    return this.order.filter((entry) => entry === call).length;
  }

  /** `attach`, `updates` updates, `detach`. */
  expected(updates: number): string[] {
    return ["attach", ...Array.from({ length: updates }, () => "update"), "detach"];
  }
}

// --- Ticker strategies -----------------------------------------------------------------------

/** Buys on update `buyAt` and sells on update `sellAt`. Overrides neither hook. */
class PlainTickerStrategy extends AbstractTickerStrategy {
  buyAt = 0;
  sellAt = 0;
  failUpdateAt = 0;
  seen = 0;
  lastPrice = 0;

  constructor() {
    super("Strategy");
  }

  override update(ticker: Ticker): void {
    this.seen++;
    if (this.seen === this.failUpdateAt) {
      throw new Error("update failed");
    }
    super.update(ticker);
    this.lastPrice = ticker.last ?? 0;
    if (this.seen === this.buyAt) {
      this.emitBuy(ticker.instrument, this.lastPrice);
    } else if (this.seen === this.sellAt) {
      this.emitSell(ticker.instrument, this.lastPrice);
    }
  }
}

/**
 * The same strategy, recording its hooks. It can also signal from them: an info signal from each
 * hook, and, with `tradeFromHooks`, a buy on attach and a sell on detach.
 */
class HookedTickerStrategy extends PlainTickerStrategy {
  readonly calls = new Calls();
  signalFromHooks = false;
  tradeFromHooks = false;
  failOnAttach = false;
  failOnDetach = false;

  override onAttach(context: StrategyContext): void {
    this.calls.attach(context);
    if (this.failOnAttach) {
      throw new Error("attach failed");
    }
    if (this.signalFromHooks) {
      this.emitInfo(BTC);
    }
    if (this.tradeFromHooks) {
      this.emitBuy(BTC, ATTACH_PRICE);
    }
  }

  override update(ticker: Ticker): void {
    this.calls.update();
    super.update(ticker);
  }

  override onDetach(context: StrategyContext): void {
    this.calls.detach(context);
    if (this.failOnDetach) {
      throw new Error("detach failed");
    }
    if (this.signalFromHooks) {
      this.emitInfo(BTC);
    }
    if (this.tradeFromHooks) {
      this.emitSell(BTC, this.lastPrice);
    }
  }
}

/**
 * A strategy whose `update` never calls `super.update`, so the clock the engine reads the time of
 * its signals from is never advanced: everything it emits is stamped zero.
 */
class BareTickerStrategy extends AbstractTickerStrategy {
  seen = 0;

  constructor() {
    super("Strategy");
  }

  override update(ticker: Ticker): void {
    this.seen++;
    const price = ticker.last ?? 0;
    if (this.seen === 1) {
      this.emitBuy(ticker.instrument, price);
    } else if (this.seen === 4) {
      this.emitSell(ticker.instrument, price);
    }
  }
}

/** The same strategy, hooked: attached, it must still see the clock it always had. */
class BareHookedTickerStrategy extends BareTickerStrategy {
  override onAttach(_context: StrategyContext): void {}

  override onDetach(_context: StrategyContext): void {}
}

// --- Bar strategies --------------------------------------------------------------------------

/** Buys on bar `buyAt` and sells on bar `sellAt`, at the bar's close. */
class PlainKlineStrategy extends AbstractKlineStrategy {
  buyAt = 0;
  sellAt = 0;
  seen = 0;
  lastPrice = 0;

  constructor() {
    super("Strategy");
  }

  override update(kline: Kline): void {
    super.update(kline);
    this.seen++;
    this.lastPrice = kline.close;
    if (this.seen === this.buyAt) {
      this.emitBuy(kline.instrument, this.lastPrice);
    } else if (this.seen === this.sellAt) {
      this.emitSell(kline.instrument, this.lastPrice);
    }
  }
}

class HookedKlineStrategy extends PlainKlineStrategy {
  readonly calls = new Calls();
  signalFromHooks = false;
  tradeFromHooks = false;
  failOnAttach = false;

  override onAttach(context: StrategyContext): void {
    this.calls.attach(context);
    if (this.failOnAttach) {
      throw new Error("attach failed");
    }
    if (this.signalFromHooks) {
      this.emitInfo(BTC);
    }
    if (this.tradeFromHooks) {
      this.emitBuy(BTC, ATTACH_PRICE);
    }
  }

  override update(kline: Kline): void {
    this.calls.update();
    super.update(kline);
  }

  override onDetach(context: StrategyContext): void {
    this.calls.detach(context);
    if (this.signalFromHooks) {
      this.emitInfo(BTC);
    }
    if (this.tradeFromHooks) {
      this.emitSell(BTC, this.lastPrice);
    }
  }
}

// --- Data ------------------------------------------------------------------------------------

/** Five ticks rising 100 to 140, one minute apart from `T0`. */
function risingTickers(): Ticker[] {
  return Array.from({ length: 5 }, (_, i) => makeTicker(100 + i * 10, T0 + i * MINUTE, BTC));
}

/** A closed one-minute bar closing at `close`, stamped with its close time; flat, so fills are unambiguous. */
function bar(index: number, close: number): Kline {
  return {
    instrument: BTC,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    quoteVolume: close,
    numberOfTrades: 1,
    timestamp: T0 + index * MINUTE + MINUTE - 1,
  };
}

/** Five bars rising 100 to 140. */
function risingBars(): Kline[] {
  return Array.from({ length: 5 }, (_, i) => bar(i, 100 + i * 10));
}

/** The signals of exactly one class, so a subclass of it does not count. */
function ofType(signals: StrategySignal[], type: abstract new (...args: never[]) => StrategySignal): StrategySignal[] {
  return signals.filter((signal) => signal.constructor === type);
}

// --- The calls -------------------------------------------------------------------------------

describe("a ticker or bar backtest tells the strategy about its source", () => {
  it("a ticker run attaches once before the first update and detaches once after the last", () => {
    const strategy = new HookedTickerStrategy();

    const result = BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    expect(result.totalTicks).toBe(5);
    expect(strategy.calls.order).toEqual(strategy.calls.expected(5));
  });

  it("a bar run attaches once before the first update and detaches once after the last", () => {
    const strategy = new HookedKlineStrategy();

    const result = BacktestRunner.runKlines(strategy, risingBars(), NO_FEES);

    expect(result.totalTicks).toBe(5);
    expect(strategy.calls.order).toEqual(strategy.calls.expected(5));
  });

  it("a run over no data is still attached and detached once", () => {
    const strategy = new HookedTickerStrategy();

    const result = BacktestRunner.run(strategy, [], NO_FEES);

    expect(result.totalTicks).toBe(0);
    expect(strategy.calls.order).toEqual(["attach", "detach"]);
  });
});

// --- What the context says -------------------------------------------------------------------

describe("the context a backtest hands over", () => {
  it("the ticker context describes the replay", () => {
    const strategy = new HookedTickerStrategy();

    BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    const attach = strategy.calls.attached[0] as StrategyContext;
    expect(attach.getId()).toBe("backtest");
    expect(attach.getVenueType()).toBe(VenueType.CEX);
    expect(attach.getVenueTypeName()).toBe("cex");
    expect(attach.getExchange()).toBe("backtest");
    expect(attach.getSegment()).toBe("spot");
    expect(attach.getType()).toBe(MarketDataSource.Ticker);
    expect(attach.getTypeName()).toBe("ticker");
    expect(attach.isWarmingUp()).toBe(false);
    expect(attach.getReason()).toBe("");
    // A strategy that finds its instruments in the data has none to report before the data.
    expect(attach.getInstrumentCount()).toBe(0);

    const detach = strategy.calls.detached[0] as StrategyContext;
    expect(detach.equals(attach.detached(StrategyContext.REASON_OWNER))).toBe(true);
    expect(detach.getReason()).toBe("OWNER");
    expect(detach.isWarmingUp()).toBe(false);
  });

  it("the bar context says KLine", () => {
    const strategy = new HookedKlineStrategy();

    BacktestRunner.runKlines(strategy, risingBars(), NO_FEES);

    const attach = strategy.calls.attached[0] as StrategyContext;
    expect(attach.getType()).toBe(MarketDataSource.KLine);
    expect(attach.getTypeName()).toBe("kline");
    expect(attach.getId()).toBe("backtest");
    expect(attach.getVenueType()).toBe(VenueType.CEX);
    expect(attach.getExchange()).toBe("backtest");
    expect(attach.getSegment()).toBe("spot");
    expect((strategy.calls.detached[0] as StrategyContext).getReason()).toBe("OWNER");
  });

  /** The strategy's own instruments are reported, sorted, whatever order it added them in. */
  it("instruments the strategy holds before the run are reported sorted by symbol", () => {
    const strategy = new HookedTickerStrategy();
    strategy.instruments.add(ETH);
    strategy.instruments.add(BTC);

    BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    const attach = strategy.calls.attached[0] as StrategyContext;
    expect(attach.instrumentList().map((instrument) => instrument.symbol())).toEqual([BTC, ETH]);
    expect(attach.getInstrument(0)).toBe(BTC);
    expect(attach.hasInstrument(ETH)).toBe(true);
    // The detach context describes the same attachment, with the same instruments.
    expect((strategy.calls.detached[0] as StrategyContext).instrumentList()).toEqual(attach.instrumentList());
  });

  it("a run reports the instruments an earlier run left in the strategy", () => {
    const strategy = new HookedTickerStrategy();

    BacktestRunner.run(strategy, risingTickers(), NO_FEES);
    BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    expect((strategy.calls.attached[0] as StrategyContext).getInstrumentCount()).toBe(0);
    expect((strategy.calls.attached[1] as StrategyContext).instrumentList().map((i) => i.symbol())).toEqual([BTC]);
  });
});

// --- Signals emitted from the hooks ----------------------------------------------------------

describe("a signal emitted from a hook", () => {
  /**
   * A signal from a hook is handled like one from `update`: a buy on attach and a sell on detach
   * make a round trip that is part of the result. The sell only counts if the detach runs before
   * the result is built, which is the ordering this pins.
   */
  it("is handled like any other", () => {
    const strategy = new HookedTickerStrategy();
    strategy.tradeFromHooks = true;

    const result = BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    // Bought 10 BTC at 100 with the full 1000 before the first tick, sold them at 140 after the last.
    expect(result.metrics.totalTrades).toBe(1);
    expect(result.yields).toHaveLength(1);
    expect(result.finalEquity).toBe(1400);
    expect(result.totalTicks).toBe(5);
  });

  it("is handled like any other on a bar run", () => {
    const strategy = new HookedKlineStrategy();
    strategy.tradeFromHooks = true;

    const result = BacktestRunner.runKlines(strategy, risingBars(), NO_FEES);

    expect(result.metrics.totalTrades).toBe(1);
    expect(result.finalEquity).toBe(1400);
  });

  /** A signal from `onAttach` takes the first tick's time, one from `onDetach` the last's. */
  it("carries the time of the first and the last tick on a ticker run", () => {
    const strategy = new HookedTickerStrategy();
    strategy.signalFromHooks = true;
    strategy.tradeFromHooks = true;
    const signals: StrategySignal[] = [];
    strategy.onSignal((signal) => signals.push(signal));

    const result = BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    const first = T0;
    const last = T0 + 4 * MINUTE;
    expect(ofType(signals, InfoStrategySignal).map((signal) => signal.timestamp)).toEqual([first, last]);
    expect(ofType(signals, BuySignal).map((signal) => signal.timestamp)).toEqual([first]);
    expect(ofType(signals, SellSignal).map((signal) => signal.timestamp)).toEqual([last]);
    // The chart markers the run draws for the signals and the fills carry the same times.
    expect(new Set(result.session.markers.map((marker) => marker.timestamp))).toEqual(new Set([first, last]));
    expect(result.session.trades.map((trade) => [trade.entryTime, trade.exitTime])).toEqual([[first, last]]);
  });

  /** On a bar run the clock is the bar's close time, as it is for every other signal. */
  it("carries the close time of the first and the last bar on a bar run", () => {
    const strategy = new HookedKlineStrategy();
    strategy.signalFromHooks = true;
    const signals: StrategySignal[] = [];
    strategy.onSignal((signal) => signals.push(signal));

    BacktestRunner.runKlines(strategy, risingBars(), NO_FEES);

    const firstClose = T0 + MINUTE - 1;
    const lastClose = T0 + 4 * MINUTE + MINUTE - 1;
    expect(ofType(signals, InfoStrategySignal).map((signal) => signal.timestamp)).toEqual([firstClose, lastClose]);
  });
});

// --- When the run does not end quietly -------------------------------------------------------

describe("when the run does not end quietly", () => {
  it("onDetach runs when an update fails, and the failure is still the run's failure", () => {
    const strategy = new HookedTickerStrategy();
    strategy.failUpdateAt = 3;

    expect(() => BacktestRunner.run(strategy, risingTickers(), NO_FEES)).toThrow(new Error("update failed"));

    expect(strategy.calls.order).toEqual(["attach", "update", "update", "update", "detach"]);
  });

  it("a failing onDetach does not hide the failure that ended the run", () => {
    const strategy = new HookedTickerStrategy();
    strategy.failUpdateAt = 3;
    strategy.failOnDetach = true;

    expect(() => BacktestRunner.run(strategy, risingTickers(), NO_FEES)).toThrow(new Error("update failed"));

    expect(strategy.calls.count("detach")).toBe(1);
  });

  it("a failing onDetach after a replay that finished fails the run", () => {
    const strategy = new HookedTickerStrategy();
    strategy.failOnDetach = true;

    expect(() => BacktestRunner.run(strategy, risingTickers(), NO_FEES)).toThrow(new Error("detach failed"));

    expect(strategy.calls.order).toEqual(strategy.calls.expected(5));
  });

  it("onDetach does not run when onAttach throws", () => {
    const strategy = new HookedTickerStrategy();
    strategy.failOnAttach = true;

    expect(() => BacktestRunner.run(strategy, risingTickers(), NO_FEES)).toThrow(new Error("attach failed"));

    // The run never started: no update, and nothing to detach.
    expect(strategy.calls.order).toEqual(["attach"]);
  });

  it("onDetach does not run when onAttach throws on a bar run", () => {
    const strategy = new HookedKlineStrategy();
    strategy.failOnAttach = true;

    expect(() => BacktestRunner.runKlines(strategy, risingBars(), NO_FEES)).toThrow(new Error("attach failed"));

    expect(strategy.calls.order).toEqual(["attach"]);
  });
});

// --- Sweeps ----------------------------------------------------------------------------------

/**
 * A parameter sweep is a loop over runs, each with a strategy of its own, so each run is attached
 * and detached on its own: there is no state between the pairs.
 */
describe("a sweep of runs", () => {
  it("gives every run a strategy of its own and its own pair of calls", () => {
    const created = Array.from({ length: 3 }, () => new HookedTickerStrategy());

    const results = created.map((strategy) => BacktestRunner.run(strategy, risingTickers(), NO_FEES));

    expect(results).toHaveLength(3);
    expect(new Set(created).size).toBe(3);
    for (const strategy of created) {
      expect(strategy.calls.order).toEqual(strategy.calls.expected(5));
    }
  });

  it("attaches and detaches a strategy again when it is run again", () => {
    const strategy = new HookedTickerStrategy();

    BacktestRunner.run(strategy, risingTickers(), NO_FEES);
    BacktestRunner.run(strategy, risingTickers(), NO_FEES);

    expect(strategy.calls.count("attach")).toBe(2);
    expect(strategy.calls.count("detach")).toBe(2);
    expect(strategy.calls.order[0]).toBe("attach");
    expect(strategy.calls.order.at(-1)).toBe("detach");
  });

  it("an onAttach that throws fails its own run and leaves the next one alone", () => {
    const failing = new HookedTickerStrategy();
    failing.failOnAttach = true;
    const healthy = new HookedTickerStrategy();

    expect(() => BacktestRunner.run(failing, risingTickers(), NO_FEES)).toThrow("attach failed");
    BacktestRunner.run(healthy, risingTickers(), NO_FEES);

    expect(failing.calls.order).toEqual(["attach"]);
    expect(healthy.calls.order).toEqual(healthy.calls.expected(5));
  });
});

// --- Nothing else changes --------------------------------------------------------------------

describe("the hooks change nothing else", () => {
  it("a ticker strategy that records the hooks trades exactly like one that does not", () => {
    const fees: BacktestConfig = { initialFunding: 1000, feeRate: 0.001, feeRateBuy: 0.001, feeRateSell: 0.002, currency: "USDT" };
    const plain = new PlainTickerStrategy();
    plain.buyAt = 1;
    plain.sellAt = 4;
    const hooked = new HookedTickerStrategy();
    hooked.buyAt = 1;
    hooked.sellAt = 4;

    const withoutHooks = BacktestRunner.run(plain, risingTickers(), fees);
    const withHooks = BacktestRunner.run(hooked, risingTickers(), fees);

    expect(withoutHooks.metrics.totalTrades).toBe(1);
    expect(withHooks).toEqual(withoutHooks);
    expect(hooked.calls.order).toEqual(hooked.calls.expected(5));
  });

  it("a bar strategy that records the hooks trades exactly like one that does not", () => {
    const fees: BacktestConfig = { initialFunding: 1000, feeRate: 0.001, feeRateBuy: 0.001, feeRateSell: 0.002, currency: "USDT" };
    const plain = new PlainKlineStrategy();
    plain.buyAt = 1;
    plain.sellAt = 4;
    const hooked = new HookedKlineStrategy();
    hooked.buyAt = 1;
    hooked.sellAt = 4;

    const withoutHooks = BacktestRunner.runKlines(plain, risingBars(), fees);
    const withHooks = BacktestRunner.runKlines(hooked, risingBars(), fees);

    expect(withoutHooks.metrics.totalTrades).toBe(1);
    expect(withHooks).toEqual(withoutHooks);
  });

  /**
   * The time of the first data point is lent to `onAttach` and taken back. A strategy that never
   * advances its own clock keeps stamping what it emits with zero, as it always did, instead of
   * with the first data point's time for the whole run.
   */
  it("the clock lent to onAttach is not left behind", () => {
    const plain = new BareTickerStrategy();
    const hooked = new BareHookedTickerStrategy();

    const withoutHooks: BacktestResult = BacktestRunner.run(plain, risingTickers(), NO_FEES);
    const withHooks: BacktestResult = BacktestRunner.run(hooked, risingTickers(), NO_FEES);

    expect(withoutHooks.yields.length).toBeGreaterThan(0);
    expect(withoutHooks.yields.every((y) => y.timestamp === 0)).toBe(true);
    expect(withHooks).toEqual(withoutHooks);
    expect(hooked.lastEventTimestamp).toBe(0);
  });
});
