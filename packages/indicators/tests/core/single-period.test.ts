import { describe, it, expect } from "vitest";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";

/**
 * A periodic indicator over one period ends a period on every tick, its first included: it follows
 * its input and is ready at once. The expected values are the Java engine's on the same input.
 */
describe("a periodic indicator over one period", () => {
  it("SMA(1) is its input and ready from the first tick", () => {
    const sma = new SmaRTIndicator(1);
    expect([5, 7, 9].map((v) => sma.update(v))).toEqual([5, 7, 9]);
    expect(sma.isReady()).toBe(true);
  });

  it("RSI(1) is 100 on a rise and 0 on a fall", () => {
    const rsi = new RsiRTIndicator(1);
    expect([5, 7, 6, 8].map((v) => rsi.update(v))).toEqual([0, 100, 0, 100]);
    expect(rsi.isReady()).toBe(true);
  });
});
