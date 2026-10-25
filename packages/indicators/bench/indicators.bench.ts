import { describe, bench } from "vitest";
import {
  // Averages
  EmaRTIndicator,
  SmaRTIndicator,
  MmaRTIndicator,
  WmaRTIndicator,
  WmaIncrementalRTIndicator,
  HmaRTIndicator,
  TemaRTIndicator,
  KamaRTIndicator,
  // Indicators
  RsiRTIndicator,
  MacdRTIndicator,
  CciRTIndicator,
  StochasticRsiRTIndicator,
  DistanceFromMaRTIndicator,
  AtrRTIndicator,
  // Bollinger
  BollingerBandsRTIndicator,
  // Helpers
  GainRTIndicator,
  LossRTIndicator,
  VolatilityRTIndicator,
  PercentVolatilityRTIndicator,
  RateChangeRTIndicator,
  PercentChangePeriodRTIndicator,
  // Numeric
  TransformRTIndicator,
  BiFunctionRTIndicator,
  ConditionalRTIndicator,
  // Statistics
  MovingAverage,
  StandardDeviationRTIndicator,
} from "../src/index";
import { prices } from "./prices";

const data = prices();

function feed(indicator: { update(v: number): number }): number {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = indicator.update(data[i]);
  }
  return last;
}

// ─── Averages ───

describe("EMA(14)", () => {
  bench("throughput", () => feed(new EmaRTIndicator(14)));
});

describe("EMA(20)", () => {
  bench("throughput", () => feed(new EmaRTIndicator(20)));
});

describe("SMA(20) discrete", () => {
  bench("throughput", () => feed(new SmaRTIndicator(20)));
});

describe("SMA(20) moving", () => {
  bench("throughput", () => feed(new SmaRTIndicator(20, MovingAverage.MOVING)));
});

describe("MMA(20)", () => {
  bench("throughput", () => feed(new MmaRTIndicator(20)));
});

describe("WMA(20)", () => {
  bench("throughput", () => feed(new WmaRTIndicator(20)));
});

describe("WmaIncremental(20)", () => {
  bench("throughput", () => feed(new WmaIncrementalRTIndicator(20)));
});

describe("HMA(20)", () => {
  bench("throughput", () => feed(new HmaRTIndicator(20)));
});

describe("TEMA(20)", () => {
  bench("throughput", () => feed(new TemaRTIndicator(20)));
});

describe("KAMA(10,2,30)", () => {
  bench("throughput", () => feed(new KamaRTIndicator(10, 2, 30)));
});

// ─── Composite Indicators ───

describe("RSI(14)", () => {
  bench("throughput", () => feed(new RsiRTIndicator(14)));
});

describe("MACD(12,26)", () => {
  bench("throughput", () => feed(new MacdRTIndicator(null, 12, 26)));
});

describe("CCI(20)", () => {
  bench("throughput", () => feed(new CciRTIndicator(20)));
});

describe("StochRSI(14)", () => {
  bench("throughput", () => feed(new StochasticRsiRTIndicator(14)));
});

describe("Bollinger(20,2)", () => {
  bench("throughput", () => feed(new BollingerBandsRTIndicator(20, 2)));
});

describe("DistanceFromSMA(20)", () => {
  bench("throughput", () => feed(DistanceFromMaRTIndicator.sma(20)));
});

describe("DistanceFromEMA(20)", () => {
  bench("throughput", () => feed(DistanceFromMaRTIndicator.ema(20)));
});

// ─── Helpers ───

describe("Gain", () => {
  bench("throughput", () => feed(new GainRTIndicator()));
});

describe("Loss", () => {
  bench("throughput", () => feed(new LossRTIndicator()));
});

describe("Volatility(20)", () => {
  bench("throughput", () => feed(new VolatilityRTIndicator(new SmaRTIndicator(20))));
});

describe("PercentVolatility(20)", () => {
  bench("throughput", () => feed(new PercentVolatilityRTIndicator(new SmaRTIndicator(20))));
});

describe("RateChange", () => {
  bench("throughput", () => feed(new RateChangeRTIndicator()));
});

describe("PercentChangePeriod", () => {
  bench("throughput", () => feed(new PercentChangePeriodRTIndicator(new GainRTIndicator())));
});

// ─── Numeric Transforms ───

describe("Transform.abs(EMA(20))", () => {
  bench("throughput", () => feed(TransformRTIndicator.abs(new EmaRTIndicator(20))));
});

describe("BiFunction.plus(EMA(20), SMA(20))", () => {
  bench("throughput", () =>
    feed(BiFunctionRTIndicator.plus(new EmaRTIndicator(20), new SmaRTIndicator(20, MovingAverage.MOVING))),
  );
});

describe("Conditional.positive(EMA(20))", () => {
  bench("throughput", () => feed(ConditionalRTIndicator.positive(new EmaRTIndicator(20))));
});

// ─── Statistics ───

describe("StdDev(20)", () => {
  bench("throughput", () => feed(new StandardDeviationRTIndicator(20)));
});

// ─── ATR (OHLC) ───

describe("ATR(14)", () => {
  bench("throughput", () => {
    const atr = new AtrRTIndicator(14);
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      atr.updateOhlc(p + 1, p - 1, p);
    }
  });
});
