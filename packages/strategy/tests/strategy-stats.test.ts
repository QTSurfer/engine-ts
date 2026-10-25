import { describe, it, expect } from "vitest";
import { StrategyStats } from "../src/StrategyStats";

describe("StrategyStats", () => {
  let stats: StrategyStats;

  function setUp() {
    stats = new StrategyStats();
  }

  it("initial state", () => {
    setUp();
    expect(stats.getTotalYields()).toBe(0);
    expect(stats.getTotalProfitYields()).toBe(0);
    expect(stats.getTotalLossYields()).toBe(0);
    expect(stats.getNetYield()).toBe(0);
    expect(stats.getTotalProfitYield()).toBe(0);
    expect(stats.getTotalLossYield()).toBe(0);
    expect(stats.getPnLRatio()).toBe(0);
  });

  it("count profit yield", () => {
    setUp();
    stats.countYield(100);
    stats.countYield(50);

    expect(stats.getTotalProfitYields()).toBe(2);
    expect(stats.getTotalLossYields()).toBe(0);
    expect(stats.getTotalYields()).toBe(2);
    expect(stats.getTotalProfitYield()).toBeCloseTo(150, 3);
    expect(stats.getNetYield()).toBeCloseTo(150, 3);
  });

  it("count loss yield", () => {
    setUp();
    stats.countYield(-30);
    stats.countYield(-20);

    expect(stats.getTotalProfitYields()).toBe(0);
    expect(stats.getTotalLossYields()).toBe(2);
    expect(stats.getTotalLossYield()).toBeCloseTo(-50, 3);
    expect(stats.getNetYield()).toBeCloseTo(-50, 3);
  });

  it("zero yield counts as profit", () => {
    setUp();
    stats.countYield(0);

    expect(stats.getTotalProfitYields()).toBe(1);
    expect(stats.getTotalLossYields()).toBe(0);
  });

  it("mixed yields", () => {
    setUp();
    stats.countYield(100);
    stats.countYield(-30);
    stats.countYield(50);
    stats.countYield(-20);

    expect(stats.getTotalProfitYields()).toBe(2);
    expect(stats.getTotalLossYields()).toBe(2);
    expect(stats.getTotalYields()).toBe(4);
    expect(stats.getNetYield()).toBeCloseTo(100, 3);
  });

  it("PnL ratio equal profits and losses", () => {
    setUp();
    stats.countYield(10);
    stats.countYield(-5);

    expect(stats.getPnLRatio()).toBe(0);
  });

  it("PnL ratio only profits", () => {
    setUp();
    stats.countYield(10);
    stats.countYield(20);

    expect(stats.getPnLRatio()).toBe(1);
  });

  it("PnL ratio only losses", () => {
    setUp();
    stats.countYield(-10);
    stats.countYield(-20);

    expect(stats.getPnLRatio()).toBe(-1);
  });

  it("PnL ratio more profits than losses", () => {
    setUp();
    stats.countYield(10);
    stats.countYield(20);
    stats.countYield(-5);

    // profits=2, losses=1 → 2/1 = 2
    expect(stats.getPnLRatio()).toBe(2);
  });

  it("PnL ratio more losses than profits", () => {
    setUp();
    stats.countYield(10);
    stats.countYield(-5);
    stats.countYield(-3);
    stats.countYield(-1);

    // profits=1, losses=3 → -(3/1) = -3
    expect(stats.getPnLRatio()).toBe(-3);
  });

  it("instrumentUpdate", () => {
    setUp();
    const result = stats.instrumentUpdate();
    expect(result).toBe(stats);
    expect(stats.getInstrumentUpdates()).toBe(1);
  });

  it("countYield returns self", () => {
    setUp();
    const result = stats.countYield(10);
    expect(result).toBe(stats);
  });
});
