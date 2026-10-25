import { describe, it, expect } from "vitest";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { DefaultStrategyYield } from "../../src/event/yield/DefaultStrategyYield";
import { YieldMetrics } from "../../src/execution/YieldMetrics";

class TestStrategy extends AbstractTickerStrategy {
  constructor() {
    super("Test");
  }
  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}

  /** Expose emitYield for testing */
  testEmitYield(input: number, output: number, timestamp: number): void {
    this.emitYield(
      new DefaultStrategyYield("BTC/USDT", "USDT", input, output, timestamp),
    );
  }
}

describe("YieldMetrics", () => {
  it("empty metrics", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);

    expect(metrics.getTotalTrades()).toBe(0);
    expect(metrics.getWinRate()).toBe(0);
    expect(metrics.getPnlTotal()).toBe(0);
    expect(metrics.getSharpeRatio()).toBe(0);
    expect(metrics.getSortinoRatio()).toBe(0);
    expect(metrics.getMaxDrawdown()).toBe(0);

    metrics.dispose();
  });

  it("profit-only trades", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 1100, ts);
    strategy.testEmitYield(1100, 1250, ts + 86400000);

    expect(metrics.getTotalTrades()).toBe(2);
    expect(metrics.getWinCount()).toBe(2);
    expect(metrics.getLossCount()).toBe(0);
    expect(metrics.getWinRate()).toBe(1);
    expect(metrics.getPnlTotal()).toBe(250);
    expect(metrics.getMaxDrawdown()).toBe(0);

    metrics.dispose();
  });

  it("loss-only trades", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 900, ts);
    strategy.testEmitYield(900, 800, ts + 86400000);

    expect(metrics.getTotalTrades()).toBe(2);
    expect(metrics.getWinCount()).toBe(0);
    expect(metrics.getLossCount()).toBe(2);
    expect(metrics.getWinRate()).toBe(0);
    expect(metrics.getPnlTotal()).toBe(-200);
    expect(metrics.getMaxDrawdown()).toBe(200);

    metrics.dispose();
  });

  it("mixed trades with drawdown", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);
    const ts = 1700000000000;

    // Win: equity 10000 → 10500
    strategy.testEmitYield(1000, 1500, ts);
    // Loss: equity 10500 → 10200
    strategy.testEmitYield(1000, 700, ts + 86400000);
    // Win: equity 10200 → 10600
    strategy.testEmitYield(1000, 1400, ts + 86400000 * 2);

    expect(metrics.getTotalTrades()).toBe(3);
    expect(metrics.getWinCount()).toBe(2);
    expect(metrics.getLossCount()).toBe(1);
    expect(metrics.getPnlTotal()).toBe(600);
    // Peak was 10500, dropped to 10200 → drawdown 300
    expect(metrics.getMaxDrawdown()).toBe(300);

    metrics.dispose();
  });

  it("sharpe and sortino ratios", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 1100, ts);               // +10%
    strategy.testEmitYield(1000, 950, ts + 86400000);      // -5%
    strategy.testEmitYield(1000, 1200, ts + 86400000 * 2); // +20%

    // Sharpe = mean([10, -5, 20]) / stdDev([10, -5, 20])
    const returns = [10, -5, 20];
    const mean = (10 - 5 + 20) / 3;
    const variance = ((10 - mean) ** 2 + (-5 - mean) ** 2 + (20 - mean) ** 2) / 3;
    const expectedSharpe = mean / Math.sqrt(variance);

    expect(metrics.getSharpeRatio()).toBeCloseTo(expectedSharpe, 6);
    expect(metrics.getSortinoRatio()).toBeGreaterThan(0);

    metrics.dispose();
  });

  it("CAGR computation", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);

    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
    const ts = 1700000000000;

    // +1000 over 1 year → equity = 11000
    strategy.testEmitYield(5000, 6000, ts);
    // Final equity should be 11000
    // CAGR = (11000/10000)^(1/1) - 1 = 10%

    // But we need at least 2 yields with different timestamps
    // to compute CAGR. Let's add another at year-end.
    strategy.testEmitYield(5000, 5000, ts + oneYearMs); // break-even

    // CAGR = (11000/10000)^(1/1) - 1 = 0.10, a ratio
    expect(metrics.getCagr()).toBeCloseTo(0.1, 6);

    metrics.dispose();
  });

  it("CAGR is a ratio: 0.21 for a 21% gain over exactly one year", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 1100, ts);
    strategy.testEmitYield(1000, 1110, ts + oneYearMs);

    expect(metrics.getCagr()).toBeCloseTo(0.21, 9);
    expect(metrics.snapshot().pnlTotalPercent).toBeCloseTo(21, 9);

    metrics.dispose();
  });

  it("CAGR does not annualize a window shorter than one year", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const ts = 1700000000000;

    // +21% over two days: annualized this would be astronomically large.
    strategy.testEmitYield(1000, 1100, ts);
    strategy.testEmitYield(1000, 1110, ts + twoDaysMs);

    expect(metrics.getCagr()).toBeCloseTo(0.21, 9);
    expect(metrics.getCagr()).toBeCloseTo(metrics.getPnlTotalPercent() / 100, 9);

    metrics.dispose();
  });

  it("CAGR annualizes from one year on, with no jump at the floor", () => {
    const yearMs = 365.25 * 24 * 60 * 60 * 1000;
    const ts = 1700000000000;
    const at = (spanMs: number): number => {
      const strategy = new TestStrategy();
      const metrics = new YieldMetrics(strategy, 1000);
      strategy.testEmitYield(1000, 1100, ts);
      strategy.testEmitYield(1000, 1110, ts + spanMs);
      const cagr = metrics.getCagr();
      metrics.dispose();
      return cagr;
    };

    expect(at(yearMs * 0.999)).toBeCloseTo(0.21, 6);
    expect(at(yearMs)).toBeCloseTo(0.21, 9);
    expect(at(yearMs * 2)).toBeCloseTo(Math.sqrt(1.21) - 1, 9);
  });

  it("a trade is a win only when its yield is strictly positive", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 1000, ts);          // zero yield: a loss
    strategy.testEmitYield(1000, 1001, ts + 1000);   // win
    strategy.testEmitYield(0, 5, ts + 2000);         // no invested input, positive yield: a win

    expect(metrics.getWinCount()).toBe(2);
    expect(metrics.getLossCount()).toBe(1);
    expect(metrics.getWinRate()).toBeCloseTo(2 / 3, 12);

    metrics.dispose();
  });

  it("max drawdown percent", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);
    const ts = 1700000000000;

    // Equity: 1000 → 1500 (peak)
    strategy.testEmitYield(500, 1000, ts);
    // Equity: 1500 → 1200
    strategy.testEmitYield(500, 200, ts + 1000);

    // Drawdown: 1500 - 1200 = 300
    // Drawdown%: 300/1500 * 100 = 20%
    expect(metrics.getMaxDrawdownPercent()).toBeCloseTo(20, 0);

    metrics.dispose();
  });

  it("snapshot captures all metrics", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 10000);
    const ts = 1700000000000;

    strategy.testEmitYield(1000, 1100, ts);
    strategy.testEmitYield(1000, 950, ts + 86400000);

    const snap = metrics.snapshot();
    expect(snap.totalTrades).toBe(2);
    expect(snap.winCount).toBe(1);
    expect(snap.lossCount).toBe(1);
    expect(snap.winRate).toBe(0.5);
    expect(snap.pnlTotal).toBe(50);

    metrics.dispose();
  });
});

describe("YieldMetrics weekly returns", () => {
  const WEEK = 7 * 86400000;
  const T0 = 1700000000000;

  it("empty run has an empty vector", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);

    expect(metrics.getWeeklyReturns()).toEqual([]);
    expect(metrics.snapshot().weeklyReturns).toEqual([]);

    metrics.dispose();
  });

  it("buckets PnL into fixed seven-day windows from the first timestamp", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);

    // Week 0: +10 (two yields), week 0 again: +5 -> 15 total. Week 2: -3. Week 1 stays empty (0).
    strategy.testEmitYield(100, 110, T0); // +10, week 0
    strategy.testEmitYield(100, 105, T0 + 86400000); // +5, week 0 (1 day later)
    strategy.testEmitYield(100, 97, T0 + 2 * WEEK + 3600000); // -3, week 2

    const weekly = metrics.getWeeklyReturns();
    // span = 2 weeks + 1h -> 3 buckets (weeks 0,1,2), week 1 empty.
    expect(weekly).toHaveLength(3);
    expect(weekly[0]).toBeCloseTo(15, 9);
    expect(weekly[1]).toBeCloseTo(0, 9);
    expect(weekly[2]).toBeCloseTo(-3, 9);

    metrics.dispose();
  });

  it("a single-week run has one bucket summing all PnL", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);

    strategy.testEmitYield(100, 110, T0); // +10
    strategy.testEmitYield(100, 95, T0 + WEEK - 1); // -5, still inside week 0 (boundary exclusive)

    const weekly = metrics.getWeeklyReturns();
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toBeCloseTo(5, 9); // +10 - 5

    metrics.dispose();
  });

  it("the weekly vector sums to the total PnL", () => {
    const strategy = new TestStrategy();
    const metrics = new YieldMetrics(strategy, 1000);

    strategy.testEmitYield(100, 110, T0);
    strategy.testEmitYield(100, 108, T0 + WEEK + 10);
    strategy.testEmitYield(100, 95, T0 + 3 * WEEK);

    const weeklySum = metrics.getWeeklyReturns().reduce((s, v) => s + v, 0);
    expect(weeklySum).toBeCloseTo(metrics.getPnlTotal(), 9);

    metrics.dispose();
  });
});

// Port of the Java engine's getAdaptivePeriodReturns cases (YieldMetricsWeeklyReturnsTest), same values
describe("YieldMetrics.getAdaptivePeriodReturns", () => {
  const T0 = 1700000000000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  const WEEK = 7 * DAY;

  function setup(): { strategy: TestStrategy; metrics: YieldMetrics } {
    const strategy = new TestStrategy();
    return { strategy, metrics: new YieldMetrics(strategy, 10000) };
  }

  it("is empty with no yields, in the snapshot too", () => {
    const { metrics } = setup();
    expect(metrics.getAdaptivePeriodReturns(T0, T0 + WEEK)).toEqual([]);
    expect(metrics.snapshot(T0, T0 + WEEK).weeklyReturns).toEqual([]);
    metrics.dispose();
  });

  it("buckets a two-day range by the hour: neither weeks nor days reach 20 buckets", () => {
    const { strategy, metrics } = setup();
    strategy.testEmitYield(100, 110, T0);
    strategy.testEmitYield(100, 90, T0 + 25 * HOUR + 10);
    const adaptive = metrics.getAdaptivePeriodReturns(T0, T0 + 2 * DAY);
    expect(adaptive).toHaveLength(49);
    expect(adaptive[0]).toBeCloseTo(10, 9);
    expect(adaptive[25]).toBeCloseTo(-10, 9);
    expect(adaptive.filter((v) => v !== 0)).toHaveLength(2);
    metrics.dispose();
  });

  it("buckets a 25-day range by the day", () => {
    const { strategy, metrics } = setup();
    strategy.testEmitYield(100, 110, T0);
    strategy.testEmitYield(100, 90, T0 + 20 * DAY + 10);
    const adaptive = metrics.getAdaptivePeriodReturns(T0, T0 + 25 * DAY);
    expect(adaptive).toHaveLength(26);
    expect(adaptive[0]).toBeCloseTo(10, 9);
    expect(adaptive[20]).toBeCloseTo(-10, 9);
    metrics.dispose();
  });

  it("buckets a 20-week range by the week", () => {
    const { strategy, metrics } = setup();
    strategy.testEmitYield(100, 110, T0);
    strategy.testEmitYield(100, 90, T0 + 19 * WEEK + 10);
    const adaptive = metrics.getAdaptivePeriodReturns(T0, T0 + 20 * WEEK);
    expect(adaptive).toHaveLength(21);
    expect(adaptive[0]).toBeCloseTo(10, 9);
    expect(adaptive[19]).toBeCloseTo(-10, 9);
    metrics.dispose();
  });

  it("takes its boundaries from the range, not from the first trade", () => {
    const { strategy, metrics } = setup();
    strategy.testEmitYield(100, 110, T0);
    const adaptive = metrics.getAdaptivePeriodReturns(T0 - DAY, T0 + DAY);
    expect(adaptive).toHaveLength(49);
    expect(adaptive[24]).toBeCloseTo(10, 9);
    expect(adaptive.filter((v) => v !== 0)).toHaveLength(1);
    metrics.dispose();
  });

  it("sums back to the total PnL", () => {
    const { strategy, metrics } = setup();
    strategy.testEmitYield(100, 110, T0);
    strategy.testEmitYield(100, 108, T0 + HOUR);
    strategy.testEmitYield(100, 95, T0 + 5 * HOUR);
    const sum = metrics.getAdaptivePeriodReturns(T0, T0 + 6 * HOUR).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(metrics.getPnlTotal(), 9);
    metrics.dispose();
  });
});
