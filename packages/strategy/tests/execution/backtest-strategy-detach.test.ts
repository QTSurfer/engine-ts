import { describe, expect, it } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractKlineStrategy } from "../../src/AbstractKlineStrategy";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import type { StrategySignal } from "../../src/event/signal/StrategySignal";
import { SystemSignal } from "../../src/event/signal/SystemSignal";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import { StrategyContext } from "../../src/StrategyContext";
import { makeTicker } from "../helpers/tickers";

/**
 * A strategy that calls `detach()` in a backtest is detached from that instrument, as a live run
 * detaches a source: from the next data point the run reads nothing more of it, so neither the
 * strategy nor the simulated venue see it again. When the strategy has nothing left to read (it
 * detached the attachment, or the last instrument of the data) the run ends there, and `onDetach`
 * is called once, with the strategy's reason.
 */

const BTC = "BTC/USDT";
const ETH = "ETH/USDT";
const T0 = 1_700_000_000_000;
const MINUTE = 60_000;
const NO_FEES: BacktestConfig = { initialFunding: 1000, feeRate: 0, currency: "USDT" };

// --- Strategies ------------------------------------------------------------------------------

/** Records what it was told, and detaches when it is set to. */
class DetachingTickerStrategy extends AbstractTickerStrategy {
  readonly calls: string[] = [];
  private readonly counts = new Map<string, number>();
  /** On which BTC update to detach BTC; 0 never. */
  detachBtcAt = 0;
  /** On which BTC update to detach the attachment; 0 never. */
  detachAttachmentAtBtc = 0;
  detachOnAttach = false;
  detachInOnDetach = false;
  /** Buys BTC on its first update with a stop at 90, which later BTC prices cross. */
  buyBtcWithStop = false;
  attachment: StrategyContext | undefined;

  constructor() {
    super("Strategy");
  }

  seen(instrument: string): number {
    return this.counts.get(instrument) ?? 0;
  }

  override onAttach(context: StrategyContext): void {
    this.calls.push("attach");
    this.attachment = context;
    if (this.detachOnAttach) {
      this.detach(context);
    }
  }

  override update(ticker: Ticker): void {
    const instrument = ticker.instrument;
    const count = this.seen(instrument) + 1;
    this.counts.set(instrument, count);
    this.calls.push(`update ${instrument}`);
    super.update(ticker);
    if (instrument !== BTC) {
      return;
    }
    if (this.buyBtcWithStop && count === 1) {
      this.emitSignal(this.createBuySignal(instrument, ticker.last ?? 0).setStopPrice(90));
    }
    // The attachment first: a detach of one instrument asked right after it must not undo it.
    if (count === this.detachAttachmentAtBtc && this.attachment !== undefined) {
      this.detach(this.attachment);
    }
    if (count === this.detachBtcAt) {
      this.detach(BTC);
    }
  }

  override onDetach(context: StrategyContext): void {
    this.calls.push(`detach ${context.getReason()}`);
    if (this.detachInOnDetach) {
      this.detach(context);
      this.detach(BTC);
    }
  }

  /** The calls that were a detach. */
  detaches(): string[] {
    return this.calls.filter((call) => call.startsWith("detach"));
  }
}

/**
 * A window on the BTC price whose listener detaches BTC the first time the window closes. The
 * listener is a closure of the strategy, so it asks the way the strategy does, about the
 * instrument of the group it was set up for.
 */
class WindowDetachStrategy extends DetachingTickerStrategy {
  /** How many BTC updates had been read when the window closed; 0 before it did. */
  detachedAtUpdate = 0;
  /** The instruments whose indicators were set up. */
  readonly setUp: string[] = [];

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    this.setUp.push(indicators.instrument);
    if (indicators.instrument !== BTC) {
      return;
    }
    indicators.ema("ema", 3).window("ema", "s5", () => {
      if (this.detachedAtUpdate === 0) {
        this.detachedAtUpdate = this.seen(indicators.instrument);
        this.detach(indicators.instrument);
      }
    });
  }
}

/** Detaches its instrument on bar `detachAt`. */
class DetachingKlineStrategy extends AbstractKlineStrategy {
  readonly calls: string[] = [];
  detachAt = 0;
  private seen = 0;

  constructor() {
    super("Strategy");
  }

  override onAttach(_context: StrategyContext): void {
    this.calls.push("attach");
  }

  override update(kline: Kline): void {
    super.update(kline);
    this.seen++;
    this.calls.push("update");
    if (this.seen === this.detachAt) {
      this.detach(kline.instrument);
    }
  }

  override onDetach(context: StrategyContext): void {
    this.calls.push(`detach ${context.getReason()}`);
  }
}

// --- Data ------------------------------------------------------------------------------------

/** `n` ticks of BTC, rising from 100. */
function btc(n: number): Ticker[] {
  return Array.from({ length: n }, (_, i) => makeTicker(100 + i, T0 + i * MINUTE, BTC));
}

/** `n` ticks of BTC and `n` of ETH, one of each per minute, BTC first. */
function btcAndEth(n: number): Ticker[] {
  return Array.from({ length: n }, (_, i) => [
    makeTicker(100 + i, T0 + i * MINUTE, BTC),
    makeTicker(50 + i, T0 + i * MINUTE, ETH),
  ]).flat();
}

/** `n` ticks of BTC and `n` of ETH, one of each per second, BTC first: windows of seconds close. */
function btcAndEthPerSecond(n: number): Ticker[] {
  return Array.from({ length: n }, (_, i) => [
    makeTicker(100 + i, T0 + i * 1000, BTC),
    makeTicker(50 + i, T0 + i * 1000, ETH),
  ]).flat();
}

/**
 * BTC at 100, 95 and 89, a stop at 90 is crossed on the third; ETH flat in between, well above the
 * stop: the pipeline is one position wide, so a price of another instrument below it would fire it.
 */
function btcFallingThroughTheStop(): Ticker[] {
  return [
    makeTicker(100, T0, BTC),
    makeTicker(500, T0, ETH),
    makeTicker(95, T0 + MINUTE, BTC),
    makeTicker(500, T0 + MINUTE, ETH),
    makeTicker(89, T0 + 2 * MINUTE, BTC),
    makeTicker(500, T0 + 2 * MINUTE, ETH),
  ];
}

function bars(n: number): Kline[] {
  return Array.from({ length: n }, (_, i) => {
    const price = 100 + i;
    return {
      instrument: BTC,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1,
      quoteVolume: price,
      numberOfTrades: 1,
      timestamp: T0 + i * MINUTE + MINUTE - 1,
    };
  });
}

/** Every signal the strategy emits from now on. */
function watch(strategy: AbstractTickerStrategy): StrategySignal[] {
  const signals: StrategySignal[] = [];
  strategy.onSignal((signal) => signals.push(signal));
  return signals;
}

function systemSignals(signals: StrategySignal[]): SystemSignal[] {
  return signals.filter((signal): signal is SystemSignal => signal instanceof SystemSignal);
}

// --- One instrument of several ---------------------------------------------------------------

describe("a strategy that detaches one instrument of several", () => {
  it("reaches the strategy no more from the next data point, and the others go on", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachBtcAt = 3;

    const result = BacktestRunner.run(strategy, btcAndEth(10), NO_FEES);

    expect(strategy.seen(BTC)).toBe(3);
    expect(strategy.seen(ETH)).toBe(10);
    expect(result.totalTicks).toBe(13); // only what was delivered
    // ETH is still read until the data ends, so the run ends as any other: the owner's detach.
    expect(strategy.calls[0]).toBe("attach");
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_OWNER}`);
    expect(strategy.detaches()).toHaveLength(1);
  });

  it("the simulated venue no longer sees the detached instrument", () => {
    const keeps = new DetachingTickerStrategy();
    keeps.buyBtcWithStop = true;
    const detaches = new DetachingTickerStrategy();
    detaches.buyBtcWithStop = true;
    // At 95, with the position open and its stop armed; the 89 that would fire it is not read.
    detaches.detachBtcAt = 2;

    const kept = BacktestRunner.run(keeps, btcFallingThroughTheStop(), NO_FEES);
    const detached = BacktestRunner.run(detaches, btcFallingThroughTheStop(), NO_FEES);

    expect(kept.yields).toHaveLength(1); // the stop at 90 fills at the 89 of BTC
    expect(detached.yields).toHaveLength(0); // BTC is not read after the detach
    expect(detached.totalTicks).toBe(5);
  });

  it("a window listener detaches the instrument of its window", () => {
    const strategy = new WindowDetachStrategy();

    BacktestRunner.run(strategy, btcAndEthPerSecond(10), NO_FEES);

    const detachedAt = strategy.detachedAtUpdate;
    expect(detachedAt).toBeGreaterThan(0); // the window closed
    expect(detachedAt).toBeLessThan(10);
    expect(strategy.seen(BTC)).toBe(detachedAt); // BTC is read no more from the next point
    expect(strategy.seen(ETH)).toBe(10);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_OWNER}`);
  });

  it("a window listener that detaches the only instrument ends the run", () => {
    const strategy = new WindowDetachStrategy();
    const onlyBtc = btcAndEthPerSecond(10).filter((ticker) => ticker.instrument === BTC);

    const result = BacktestRunner.run(strategy, onlyBtc, NO_FEES);

    expect(strategy.detachedAtUpdate).toBeGreaterThan(0);
    expect(result.totalTicks).toBe(strategy.detachedAtUpdate);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_STRATEGY}`);
  });

  it("a detach of an instrument that is not in the data detaches nothing", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachBtcAt = 2;
    const onlyEth = btcAndEth(4).filter((ticker) => ticker.instrument === ETH);

    // BTC is never read, so the strategy never asks for it: ETH is read to the end.
    const result = BacktestRunner.run(strategy, onlyEth, NO_FEES);

    expect(result.totalTicks).toBe(4);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_OWNER}`);
  });
});

// --- Nothing left to read --------------------------------------------------------------------

describe("a strategy that detaches everything it reads", () => {
  it("detaching the only instrument ends the run there with the strategy's reason", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachBtcAt = 3;

    const result = BacktestRunner.run(strategy, btc(10), NO_FEES);

    expect(result.totalTicks).toBe(3);
    expect(strategy.calls).toEqual([
      "attach",
      `update ${BTC}`,
      `update ${BTC}`,
      `update ${BTC}`,
      `detach ${StrategyContext.REASON_STRATEGY}`,
    ]);
  });

  it("detaching every instrument of the data ends the run", () => {
    const strategy = new (class extends DetachingTickerStrategy {
      override update(ticker: Ticker): void {
        super.update(ticker);
        if (ticker.instrument === ETH && this.seen(ETH) === 4) {
          this.detach(ETH);
        }
      }
    })();
    strategy.detachBtcAt = 2;

    const result = BacktestRunner.run(strategy, btcAndEth(10), NO_FEES);

    expect(strategy.seen(BTC)).toBe(2);
    expect(strategy.seen(ETH)).toBe(4);
    expect(result.totalTicks).toBe(6);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_STRATEGY}`);
  });

  it("detaching the attachment ends the run for every instrument", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachAttachmentAtBtc = 2;

    const result = BacktestRunner.run(strategy, btcAndEth(10), NO_FEES);

    // BTC 1, ETH 1, BTC 2 (which detaches), then nothing.
    expect(strategy.seen(BTC)).toBe(2);
    expect(strategy.seen(ETH)).toBe(1);
    expect(result.totalTicks).toBe(3);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_STRATEGY}`);
    expect(strategy.detaches()).toHaveLength(1);
  });

  it("once everything is detached it stays so, whatever is asked after it", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachAttachmentAtBtc = 2;
    // Asked right after the attachment, about one instrument of two: it must not undo it.
    strategy.detachBtcAt = 2;

    const result = BacktestRunner.run(strategy, btcAndEth(10), NO_FEES);

    expect(result.totalTicks).toBe(3);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_STRATEGY}`);
  });

  it("a detach from onAttach ends the run before the first update", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachOnAttach = true;

    const result = BacktestRunner.run(strategy, btc(5), NO_FEES);

    expect(result.totalTicks).toBe(0);
    expect(strategy.calls).toEqual(["attach", `detach ${StrategyContext.REASON_STRATEGY}`]);
  });

  it("the request from onAttach names the attachment and carries the first data point's time", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachOnAttach = true;
    const signals = watch(strategy);

    BacktestRunner.run(strategy, btc(5), NO_FEES);

    const requests = systemSignals(signals);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.getAttachment()).toBe("backtest");
    expect(requests[0]?.timestamp).toBe(T0);
  });

  it("a detach on the last data point is the strategy's too", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachBtcAt = 5;

    const result = BacktestRunner.run(strategy, btc(5), NO_FEES);

    expect(result.totalTicks).toBe(5);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_STRATEGY}`);
  });

  it("a bar run ends when its instrument is detached", () => {
    const strategy = new DetachingKlineStrategy();
    strategy.detachAt = 2;

    const result = BacktestRunner.runKlines(strategy, bars(6), NO_FEES);

    expect(result.totalTicks).toBe(2);
    expect(strategy.calls).toEqual(["attach", "update", "update", `detach ${StrategyContext.REASON_STRATEGY}`]);
  });

  it("the metrics are bucketed over the span of the data, not of what was read", () => {
    const cut = new DetachingTickerStrategy();
    cut.detachBtcAt = 3;
    const whole = new DetachingTickerStrategy();

    const cutResult = BacktestRunner.run(cut, btc(10), NO_FEES);
    const wholeResult = BacktestRunner.run(whole, btc(10), NO_FEES);

    expect(cutResult.metrics).toEqual(wholeResult.metrics);
    expect(cutResult.session.equity).toEqual(wholeResult.session.equity);
  });
});

// --- The host's side -------------------------------------------------------------------------

describe("the backtest as the host of a strategy that detaches", () => {
  it("a detach from onDetach emits nothing", () => {
    const strategy = new DetachingTickerStrategy();
    strategy.detachInOnDetach = true;
    const signals = watch(strategy);

    BacktestRunner.run(strategy, btc(5), NO_FEES);

    expect(systemSignals(signals)).toHaveLength(0);
    expect(strategy.detaches()).toHaveLength(1);
  });

  it("gives the host's flag back after onDetach, so a later request is heard", () => {
    const strategy = new (class extends DetachingTickerStrategy {
      ask(instrument: string): void {
        this.detach(instrument);
      }
    })();
    strategy.detachInOnDetach = true;
    BacktestRunner.run(strategy, btc(5), NO_FEES);
    const signals = watch(strategy);

    strategy.ask(BTC);

    expect(systemSignals(signals)).toHaveLength(1);
  });

  it("a strategy that never detaches reads everything", () => {
    const strategy = new DetachingTickerStrategy();

    const result = BacktestRunner.run(strategy, btcAndEth(10), NO_FEES);

    expect(result.totalTicks).toBe(20);
    expect(strategy.calls.at(-1)).toBe(`detach ${StrategyContext.REASON_OWNER}`);
  });
});
