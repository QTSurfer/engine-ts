import { describe, it, expect } from "vitest";
import { MaxRTIndicator } from "$helpers/MaxRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("MaxRTIndicator", () => {
  it("testPlainIndicator", () => {
    const max = new MaxRTIndicator();
    expect(max.update(1)).toBe(1);
    expect(max.update(0.99)).toBe(1);
    expect(max.update(1.01)).toBe(1.01);
    expect(max.update(0.99)).toBe(1.01);
  });

  it("testFromTickerFixturesClosingPricesList", () => {
    const max = new MaxRTIndicator();
    for (const price of CLOSE_PRICES_LIST) {
      max.update(price);
    }
    expect(max.getValue()).toBe(46.45);
  });

  it("testReset", () => {
    const max = new MaxRTIndicator(3);
    const values = [1, 5, 3];
    const results: number[] = [];
    for (const v of values) {
      results.push(max.update(v));
    }

    max.reset();
    expect(max.getValue()).toBe(0);

    for (let i = 0; i < values.length; i++) {
      expect(max.update(values[i])).toBe(results[i]);
    }
  });

  it("tracks the rolling maximum when it has periods", () => {
    // window of 3: [1] 1, [1, 5] 5, [1, 5, 3] 5, [5, 3, 2] 5, [3, 2, 1] 3, [2, 1, 0] 2
    const max = new MaxRTIndicator(3);
    expect([1, 5, 3, 2, 1, 0].map((v) => max.update(v))).toEqual([1, 5, 5, 5, 3, 2]);
  });

  it("starts the window again after a reset", () => {
    const max = new MaxRTIndicator(3);
    [9, 8, 7].forEach((v) => max.update(v));
    max.reset();
    expect([1, 2].map((v) => max.update(v))).toEqual([1, 2]);
  });
});
