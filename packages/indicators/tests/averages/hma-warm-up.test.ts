import { describe, expect, it } from "vitest";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";

// The Hull average is a weighted average of a difference of two weighted averages. The difference is
// a value of the line only from the update where the full-length average is full, so the final
// average is fed from there and the indicator is ready, and equal to the formula, once it holds
// round(sqrt(periods)) of them.

const BARS = 80;

const prices = Array.from({ length: BARS }, (_, i) => 100 + 12 * Math.sin(i / 5) + 3 * Math.cos(i / 1.7) + i * 0.3);

/** The weighted average of the `length` values ending at `to`, newest weighted most. */
function wma(values: number[], to: number, length: number): number {
  let weighted = 0;
  let divisor = 0;
  for (let i = 0; i < length; i++) {
    const weight = i + 1;
    weighted += weight * values[to - length + 1 + i]!;
    divisor += weight;
  }
  return weighted / divisor;
}

describe("HmaRTIndicator warm-up", () => {
  it("is ready and equal to the formula from the update where the final average is full", () => {
    const periods = 16; // half 8, final round(sqrt(16)) = 4
    const diff = new Array<number>(BARS).fill(0);
    const hma = new HmaRTIndicator(periods);

    for (let i = 0; i < BARS; i++) {
      hma.update(prices[i]!);
      if (i >= periods - 1) {
        diff[i] = 2 * wma(prices, i, periods / 2) - wma(prices, i, periods);
      }
      const valid = i >= periods - 1 + 4 - 1; // 4 valid differences in the final window
      expect(hma.isReady(), `ready at update ${i + 1}`).toBe(valid);
      if (valid) {
        expect(hma.getValue(), `HMA at update ${i + 1}`).toBeCloseTo(wma(diff, i, 4), 9);
      }
    }
  });

  it("reads the difference itself until the full-length average is full", () => {
    const hma = new HmaRTIndicator(16);

    for (let i = 0; i < 15; i++) {
      const value = hma.update(prices[i]!);
      expect(value, `update ${i + 1}`).toBeCloseTo(2 * wma(prices, i, Math.min(8, i + 1)) - wma(prices, i, i + 1), 9);
    }
  });

  it("starts the warm-up again after a reset", () => {
    const hma = new HmaRTIndicator(16);
    prices.forEach((price) => hma.update(price));
    expect(hma.isReady()).toBe(true);

    hma.reset();
    for (let i = 0; i < 18; i++) {
      hma.update(prices[i]!);
    }
    expect(hma.isReady()).toBe(false);
    hma.update(prices[18]!);
    expect(hma.isReady()).toBe(true);
  });
});
