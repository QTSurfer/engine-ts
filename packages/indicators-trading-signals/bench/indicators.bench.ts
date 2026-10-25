import { describe, bench } from "vitest";
import { EMA, SMA, WMA, RSI, MACD, BollingerBands, StochasticRSI } from "trading-signals";
import {
  EmaRTIndicator,
  SmaRTIndicator,
  WmaRTIndicator,
  WmaIncrementalRTIndicator,
  RsiRTIndicator,
  MacdRTIndicator,
  BollingerBandsRTIndicator,
  StochasticRsiRTIndicator,
  MovingAverage,
} from "@qtsurfer/indicators";
import { prices } from "../src/BenchmarkPriceData";

const data = prices();

function feedRT(indicator: { update(v: number): number }): number {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = indicator.update(data[i]);
  }
  return last;
}

function feedTS(indicator: { update(v: number, r: boolean): unknown }): void {
  for (let i = 0; i < data.length; i++) {
    indicator.update(data[i], false);
  }
}

describe("EMA(20)", () => {
  bench("RT", () => feedRT(new EmaRTIndicator(20)));
  bench("trading-signals", () => feedTS(new EMA(20)));
});

describe("SMA(20)", () => {
  bench("RT", () => feedRT(new SmaRTIndicator(20, MovingAverage.MOVING)));
  bench("trading-signals", () => feedTS(new SMA(20)));
});

describe("WMA(20)", () => {
  bench("RT", () => feedRT(new WmaRTIndicator(20)));
  bench("RT O(1)", () => feedRT(new WmaIncrementalRTIndicator(20)));
  bench("trading-signals", () => feedTS(new WMA(20)));
});

describe("WMA(200)", () => {
  bench("RT", () => feedRT(new WmaRTIndicator(200)));
  bench("RT O(1)", () => feedRT(new WmaIncrementalRTIndicator(200)));
  bench("trading-signals", () => feedTS(new WMA(200)));
});

describe("RSI(14)", () => {
  bench("RT", () => feedRT(new RsiRTIndicator(14)));
  bench("trading-signals", () => feedTS(new RSI(14)));
});

describe("MACD(12,26)", () => {
  bench("RT", () => feedRT(new MacdRTIndicator(null, 12, 26)));
  bench("trading-signals", () =>
    feedTS(new MACD(new EMA(12), new EMA(26), new EMA(9))),
  );
});

describe("Bollinger Bands(20,2)", () => {
  bench("RT", () => feedRT(new BollingerBandsRTIndicator(20, 2)));
  bench("trading-signals", () => feedTS(new BollingerBands(20, 2)));
});

describe("StochRSI(14)", () => {
  bench("RT", () => feedRT(new StochasticRsiRTIndicator(14)));
  bench("trading-signals", () => feedTS(new StochasticRSI(14)));
});
