import { describe, it, expect } from "vitest";
import { DefaultStrategyYield } from "../../../src/event/yield/DefaultStrategyYield";

describe("DefaultStrategyYield", () => {
  it("computes positive yield", () => {
    const y = new DefaultStrategyYield("BTC/USDT", "USDT", 1000, 1100, Date.now());
    expect(y.getYield()).toBe(100);
    expect(y.getYieldPercent()).toBe(10);
  });

  it("computes negative yield", () => {
    const y = new DefaultStrategyYield("BTC/USDT", "USDT", 1000, 900, Date.now());
    expect(y.getYield()).toBe(-100);
    expect(y.getYieldPercent()).toBe(-10);
  });

  it("computes zero yield", () => {
    const y = new DefaultStrategyYield("BTC/USDT", "USDT", 1000, 1000, Date.now());
    expect(y.getYield()).toBe(0);
    expect(y.getYieldPercent()).toBe(0);
  });

  it("handles zero input gracefully", () => {
    const y = new DefaultStrategyYield("BTC/USDT", "USDT", 0, 100, Date.now());
    expect(y.getYield()).toBe(100);
    expect(y.getYieldPercent()).toBe(0);
  });

  it("preserves instrument and currency", () => {
    const y = new DefaultStrategyYield("ETH/BTC", "BTC", 500, 600, 1700000000000);
    expect(y.instrument).toBe("ETH/BTC");
    expect(y.currency).toBe("BTC");
    expect(y.input).toBe(500);
    expect(y.output).toBe(600);
    expect(y.timestamp).toBe(1700000000000);
  });
});
