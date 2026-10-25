import { describe, it, expect } from "vitest";
import {
  Asset,
  CurrencyHelper,
  DatedFutureInstrument,
  Instrument,
  PerpetualInstrument,
  SpotInstrument,
} from "../src/index";

function methodsOf(type: { prototype: object }): string[] {
  return Object.getOwnPropertyNames(type.prototype).filter((name) => name !== "constructor");
}

/**
 * The member names of the Java `Instrument` family, `Asset` and the currency helper that this
 * port carries. A rename on either side shows up here first.
 */
describe("Java parity: member names", () => {
  it("Instrument", () => {
    expect(Object.keys(Instrument).sort()).toEqual(["of", "parse"]);
  });

  it.each([
    ["SpotInstrument", SpotInstrument],
    ["PerpetualInstrument", PerpetualInstrument],
    ["DatedFutureInstrument", DatedFutureInstrument],
  ])("%s", (_name, type) => {
    expect(methodsOf(type)).toEqual(
      expect.arrayContaining(["symbol", "isDerivative", "isDated", "equals", "toString"]),
    );
  });

  it("the component accessors of each variant", () => {
    expect(methodsOf(SpotInstrument)).toEqual(expect.arrayContaining(["base", "quote"]));
    expect(methodsOf(PerpetualInstrument)).toEqual(
      expect.arrayContaining(["base", "quote", "settle"]),
    );
    expect(methodsOf(DatedFutureInstrument)).toEqual(
      expect.arrayContaining(["base", "quote", "settle", "expiry"]),
    );
  });

  it("Asset", () => {
    expect(methodsOf(Asset)).toEqual(expect.arrayContaining(["equals", "toString"]));
    expect(typeof Asset.of).toBe("function");
    expect(Object.keys(Asset.of("btc"))).toEqual(["code"]);
  });

  it("CurrencyHelper", () => {
    expect(Object.keys(CurrencyHelper).sort()).toEqual(
      ["PATTERN_ANY", "endsWith", "matchPattern", "startsWith", "toPatternSet", "toSet"].sort(),
    );
    expect(CurrencyHelper.PATTERN_ANY).toBe("¿");
  });
});
