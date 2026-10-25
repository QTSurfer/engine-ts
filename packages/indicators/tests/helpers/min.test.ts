import { describe, it, expect } from "vitest";
import { MinRTIndicator } from "$helpers/MinRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("MinRTIndicator", () => {
  it("testPlainIndicator", () => {
    const min = new MinRTIndicator();
    expect(min.update(1)).toBe(1);
    expect(min.update(2)).toBe(1);
    expect(min.update(3)).toBe(1);
    expect(min.update(0.99)).toBe(0.99);
  });

  it("testFromTickerFixturesClosingPricesList", () => {
    const min = new MinRTIndicator();
    for (const price of CLOSE_PRICES_LIST) {
      min.update(price);
    }
    expect(min.getValue()).toBe(42.66);
  });

  it("testReset", () => {
    const min = new MinRTIndicator(3);
    const values = [5, 1, 3];
    const results: number[] = [];
    for (const v of values) {
      results.push(min.update(v));
    }

    min.reset();
    expect(min.getValue()).toBe(0);

    for (let i = 0; i < values.length; i++) {
      expect(min.update(values[i])).toBe(results[i]);
    }
  });

  it("tracks the rolling minimum when it has periods", () => {
    // window of 3: [5] 5, [5, 1] 1, [5, 1, 3] 1, [1, 3, 4] 1, [3, 4, 6] 3, [4, 6, 7] 4
    const min = new MinRTIndicator(3);
    expect([5, 1, 3, 4, 6, 7].map((v) => min.update(v))).toEqual([5, 1, 1, 1, 3, 4]);
  });

  it("starts the window again after a reset", () => {
    const min = new MinRTIndicator(3);
    [1, 2, 3].forEach((v) => min.update(v));
    min.reset();
    expect([9, 8].map((v) => min.update(v))).toEqual([9, 8]);
  });
});
