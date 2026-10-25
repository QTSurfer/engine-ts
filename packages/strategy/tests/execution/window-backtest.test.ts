import { describe, expect, it } from "vitest";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { InfoStrategySignal } from "$signal/InfoStrategySignal";
import { BacktestRunner } from "$execution/BacktestRunner";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { makeTicker } from "../helpers/tickers";

const START = 1_700_000_000_000;
const INSTRUMENT = "BTC/USDT";

// The ema of 10, 20, 30, ... (period 3, alpha 0.5, starting at the first price), by hand:
//   10, 15, 22.5, 31.25, 40.625, 50.3125, 60.15625, 70.078125, 80.0390625, 90.01953125, 100.009765625
const EMA_AT_5 = 50.3125;
const EMA_AT_10 = 100.009765625;

/** A window of five seconds on an EMA: its body counts its fires in the store and reports what it saw. */
class WindowedStrategy extends AbstractTickerStrategy {
  constructor() {
    super("WindowRun");
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    indicators.ema("ema", 3).window("ema", "s5", (store, prev, actual) => {
      store.inc("fires");
      this.emitInfo(INSTRUMENT, "window", "prev", prev, "actual", actual, "fires", store.getCounter("fires"));
    });
  }
}

describe("a window with an onChange body, in a BacktestRunner run", () => {
  it("fires on the time of the ticks, with the values of the indicator it watches", () => {
    const fires: InfoStrategySignal[] = [];
    const strategy = new WindowedStrategy();
    strategy.onSignal((signal) => {
      if (signal instanceof InfoStrategySignal) fires.push(signal);
    });
    // Eleven ticks, one second apart, run in a few milliseconds of real time
    const ticks = Array.from({ length: 11 }, (_, i) => makeTicker(10 * (i + 1), START + i * 1000));

    BacktestRunner.run(strategy, ticks, { initialFunding: 1000, feeRate: 0, currency: "USDT" });

    // The same store serves both fires: its counter reads 1, then 2
    expect(fires.map((f) => Object.fromEntries(f.get<Map<string, number>>("window")!))).toEqual([
      { prev: 10, actual: EMA_AT_5, fires: 1 },
      { prev: EMA_AT_5, actual: EMA_AT_10, fires: 2 },
    ]);
  });
});
