import { describe, it, expect } from "vitest";
import { BollingerBands } from "trading-signals";
import { BollingerBandsRTIndicator } from "@qtsurfer/indicators";
import { TradingSignalsAdapter } from "../src/TradingSignalsAdapter";
import { prices, SIZE } from "../src/BenchmarkPriceData";

const PERIOD = 20;
const K = 2;
const WARMUP = 3 * PERIOD;

function createTsBollinger(extract: (r: unknown) => number) {
  return new TradingSignalsAdapter(
    () => new BollingerBands(PERIOD, K),
    extract,
  );
}

describe("Bollinger Bands: RT vs trading-signals", () => {
  it("middle band converges after warmup", () => {
    const rt = new BollingerBandsRTIndicator(PERIOD, K);
    const tsMiddle = createTsBollinger(
      (r) => (r as { middle: number }).middle,
    );
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      tsMiddle.update(data[i]);
    }

    expect(tsMiddle.isReady()).toBe(true);
    expect(rt.isReady()).toBe(true);

    // Middle band = SMA, should be very close
    const diff = Math.abs(rt.getValue() - tsMiddle.getValue());
    expect(diff).toBeLessThan(0.001);
  });

  it("upper and lower bands converge", () => {
    const rt = new BollingerBandsRTIndicator(PERIOD, K);
    const rtUpper = rt.getUpper();
    const rtLower = rt.getLower();
    const tsUpper = createTsBollinger((r) => (r as { upper: number }).upper);
    const tsLower = createTsBollinger((r) => (r as { lower: number }).lower);
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      tsUpper.update(data[i]);
      tsLower.update(data[i]);
    }

    const upperDiff = Math.abs(rtUpper.getValue() - tsUpper.getValue());
    const lowerDiff = Math.abs(rtLower.getValue() - tsLower.getValue());

    expect(upperDiff).toBeLessThan(0.1);
    expect(lowerDiff).toBeLessThan(0.1);
  });

  it("bands contain price most of the time", () => {
    const rt = new BollingerBandsRTIndicator(PERIOD, K);
    const rtUpper = rt.getUpper();
    const rtLower = rt.getLower();
    const data = prices();

    let insideBands = 0;
    let total = 0;

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      if (rt.isReady()) {
        const upper = rtUpper.getValue();
        const lower = rtLower.getValue();
        if (data[i] >= lower && data[i] <= upper) insideBands++;
        total++;
      }
    }

    // Most values should be within 2 std dev bands
    expect(insideBands / total).toBeGreaterThan(0.85);
  });

  it("reset produces identical results", () => {
    const ts = createTsBollinger((r) => (r as { middle: number }).middle);
    const data = prices();

    for (let i = 0; i < 100; i++) ts.update(data[i]);
    const valueBefore = ts.getValue();

    ts.reset();
    for (let i = 0; i < 100; i++) ts.update(data[i]);

    expect(ts.getValue()).toBe(valueBefore);
  });
});
