import { describe, it, expect } from "vitest";
import { Asset, CurrencyHelper } from "../src/index";

describe("CurrencyHelper", () => {
  it("splits plain codes from wildcard patterns, upper-casing both", () => {
    const codes = ["btc", "eth", "usd¿", "¿usd"];
    expect([...CurrencyHelper.toSet(codes)]).toEqual(["BTC", "ETH"]);
    expect([...CurrencyHelper.toPatternSet(codes)]).toEqual(["USD¿", "¿USD"]);
  });

  it("matches a leading wildcard against the end of the code", () => {
    const patterns = CurrencyHelper.toPatternSet(["¿USD"]);
    expect(CurrencyHelper.matchPattern(Asset.of("BUSD"), patterns)).toBe(true);
    expect(CurrencyHelper.matchPattern(Asset.of("TUSD"), patterns)).toBe(true);
    expect(CurrencyHelper.matchPattern(Asset.of("USDT"), patterns)).toBe(false);
  });

  it("matches a trailing wildcard against the start of the code", () => {
    const patterns = CurrencyHelper.toPatternSet(["USD¿"]);
    expect(CurrencyHelper.matchPattern(Asset.of("USDT"), patterns)).toBe(true);
    expect(CurrencyHelper.matchPattern(Asset.of("USDC"), patterns)).toBe(true);
    expect(CurrencyHelper.matchPattern(Asset.of("BUSD"), patterns)).toBe(false);
  });

  it("matches nothing without patterns", () => {
    expect(CurrencyHelper.matchPattern(Asset.of("BTC"), undefined)).toBe(false);
    expect(CurrencyHelper.matchPattern(Asset.of("BTC"), new Set())).toBe(false);
  });
});
