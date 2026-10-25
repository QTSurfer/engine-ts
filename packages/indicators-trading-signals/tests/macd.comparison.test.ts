import { describe, it, expect } from "vitest";
import { EMA, MACD } from "trading-signals";
import { MacdRTIndicator } from "@qtsurfer/indicators";
import { TradingSignalsAdapter } from "../src/TradingSignalsAdapter";
import { prices, SIZE } from "../src/BenchmarkPriceData";

const SHORT = 12;
const LONG = 26;
const SIGNAL = 9;
const WARMUP = 3 * LONG;

function createTsMacd() {
  return new TradingSignalsAdapter(
    () => new MACD(new EMA(SHORT), new EMA(LONG), new EMA(SIGNAL)),
    (r) => (r as { macd: number }).macd,
  );
}

describe("MACD: RT vs trading-signals", () => {
  it("converges after warmup", () => {
    const rt = new MacdRTIndicator(null, SHORT, LONG);
    const ts = createTsMacd();
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);
    }

    expect(ts.isReady()).toBe(true);
    expect(rt.isReady()).toBe(true);

    const diff = Math.abs(rt.getValue() - ts.getValue());
    expect(diff).toBeLessThan(0.05);
  });

  it("values oscillate around zero", () => {
    const rt = new MacdRTIndicator(null, SHORT, LONG);
    const data = prices();

    let positive = 0,
      negative = 0;
    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      if (i > WARMUP) {
        if (rt.getValue() > 0) positive++;
        else negative++;
      }
    }

    // MACD should have both positive and negative values
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
  });

  it("same sign agreement after warmup", () => {
    const rt = new MacdRTIndicator(null, SHORT, LONG);
    const ts = createTsMacd();
    const data = prices();

    let sameSign = 0;
    let total = 0;

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);

      if (i > WARMUP && ts.isReady()) {
        if (Math.sign(rt.getValue()) === Math.sign(ts.getValue())) sameSign++;
        total++;
      }
    }

    // Both should agree on MACD sign (above/below zero) most of the time
    expect(sameSign / total).toBeGreaterThan(0.8);
  });

  it("reset produces identical results", () => {
    const ts = createTsMacd();
    const data = prices();

    for (let i = 0; i < 100; i++) ts.update(data[i]);
    const valueBefore = ts.getValue();

    ts.reset();
    for (let i = 0; i < 100; i++) ts.update(data[i]);

    expect(ts.getValue()).toBe(valueBefore);
  });
});
