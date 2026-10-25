import { describe, it, expect } from "vitest";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { BollingerPercentBRTIndicator } from "$bollinger/BollingerPercentBRTIndicator";

function percentB(prices: number[], periods = 5, k = 2): BollingerPercentBRTIndicator {
  const pb = new BollingerPercentBRTIndicator(new BollingerBandsRTIndicator(periods, k));
  for (const price of prices) pb.update(price);
  return pb;
}

describe("BollingerPercentBRTIndicator", () => {
  it("is 0.5 when the price is the middle of the bands", () => {
    // The window 10, 50, 10, 50, 30 has its mean at 30, so the bands are symmetric around 30
    expect(percentB([10, 50, 10, 50, 30]).getValue()).toBeCloseTo(0.5, 12);
  });

  it("follows (price - lower) / (upper - lower)", () => {
    // Window 10..50: mean 30, sample standard deviation sqrt(250) = 15.811388...,
    // bands 30 -+ 2 * 15.811388 = -1.622776... and 61.622776...;
    // the price 50 gives (50 + 1.622776) / 63.245553 = 0.5 + 20 / (4 * sqrt(250)) = 0.816227...
    const pb = percentB([10, 20, 30, 40, 50]);
    expect(pb.getValue()).toBeCloseTo(0.5 + 20 / (4 * Math.sqrt(250)), 9);
    expect(pb.getValue()).toBeCloseTo(0.816227766017, 9);
  });

  it("is above 1 when the price is above the upper band", () => {
    // The last price jumps far above the other four: it sits outside the bands it helped to set
    const pb = percentB([100, 100, 100, 100, 100]);
    expect(pb.getValue()).toBe(0);
    const high = percentB([100, 100, 100, 100, 200], 5, 0.5);
    expect(high.getValue()).toBeGreaterThan(1);
  });

  it("is 0 for a flat series, where the bands have no width", () => {
    expect(percentB([7, 7, 7, 7, 7]).getValue()).toBe(0);
  });

  it("is ready when the bands are, and reset clears it", () => {
    const pb = new BollingerPercentBRTIndicator(new BollingerBandsRTIndicator(5, 2));
    expect(pb.isReady()).toBe(false);
    for (const price of [10, 20, 30, 40, 50]) pb.update(price);
    expect(pb.isReady()).toBe(true);
    pb.reset();
    expect(pb.getValue()).toBe(0);
    expect(pb.isReady()).toBe(false);
  });
});
