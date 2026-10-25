import { describe, it, expect } from "vitest";
import {
  FixedFeeModel,
  MakerTakerFeeModel,
} from "../../../src/execution/simulation/FeeModel";
import type { FeeContext } from "../../../src/execution/simulation/FeeModel";

function ctx(
  side: "buy" | "sell",
  counterAmount: number,
  liquidity: "maker" | "taker" = "taker",
): FeeContext {
  return {
    price: 100,
    baseAmount: counterAmount / 100,
    counterAmount,
    side,
    liquidity,
    timestamp: 0,
    instrument: "BTC/USDT",
  };
}

describe("FixedFeeModel", () => {
  it("applies the buy rate on buy fills", () => {
    const model = new FixedFeeModel(0.001, 0.002);
    expect(model.compute(ctx("buy", 10_000))).toBeCloseTo(10, 6);
  });

  it("applies the sell rate on sell fills", () => {
    const model = new FixedFeeModel(0.001, 0.002);
    expect(model.compute(ctx("sell", 10_000))).toBeCloseTo(20, 6);
  });

  it("returns zero when the per-side rate is zero", () => {
    const model = new FixedFeeModel(0, 0.001);
    expect(model.compute(ctx("buy", 10_000))).toBe(0);
  });

  it("ignores the liquidity role", () => {
    const model = new FixedFeeModel(0.001, 0.001);
    expect(model.compute(ctx("buy", 10_000, "maker"))).toBeCloseTo(10, 6);
    expect(model.compute(ctx("buy", 10_000, "taker"))).toBeCloseTo(10, 6);
  });
});

describe("MakerTakerFeeModel", () => {
  it("charges the maker rate on passive fills", () => {
    const model = new MakerTakerFeeModel(0.0002, 0.001);
    expect(model.compute(ctx("buy", 10_000, "maker"))).toBeCloseTo(2, 6);
    expect(model.compute(ctx("sell", 10_000, "maker"))).toBeCloseTo(2, 6);
  });

  it("charges the taker rate on aggressive fills", () => {
    const model = new MakerTakerFeeModel(0.0002, 0.001);
    expect(model.compute(ctx("buy", 10_000, "taker"))).toBeCloseTo(10, 6);
    expect(model.compute(ctx("sell", 10_000, "taker"))).toBeCloseTo(10, 6);
  });

  it("supports a negative maker rate (rebate)", () => {
    const model = new MakerTakerFeeModel(-0.0001, 0.001);
    expect(model.compute(ctx("buy", 10_000, "maker"))).toBeCloseTo(-1, 6);
  });
});
