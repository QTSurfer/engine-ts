import { describe, it, expect } from "vitest";
import { Asset } from "@qtsurfer/core";
import { StrategyCurrencyFilter } from "../src/StrategyCurrencyFilter";

const BTC = Asset.of("BTC");
const ETH = Asset.of("ETH");
const USDT = Asset.of("USDT");
const BUSD = Asset.of("BUSD");

describe("StrategyCurrencyFilter", () => {
  it("accepts everything until a list is set", () => {
    const filter = new StrategyCurrencyFilter();
    expect(filter.accept(BTC)).toBe(true);
    expect(filter.isWhitelisted(BTC)).toBe(true);
    expect(filter.isBlacklisted(BTC)).toBe(false);
  });

  describe("whitelist", () => {
    it("accepts only the listed assets", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["BTC", "ETH"]);
      expect(filter.accept(BTC)).toBe(true);
      expect(filter.accept(ETH)).toBe(true);
      expect(filter.accept(USDT)).toBe(false);
    });

    it("compares codes, so a different Asset object for the same code is found", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["btc"]);
      expect(filter.accept(new Asset("BTC"))).toBe(true);
      expect(filter.accept(Asset.of("btc"))).toBe(true);
    });

    it("an empty list that was set accepts nothing", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies([]);
      expect(filter.accept(BTC)).toBe(false);
    });

    it("matches wildcard patterns", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["USD¿"]);
      expect(filter.accept(USDT)).toBe(true);
      expect(filter.accept(BTC)).toBe(false);
      filter.setWhitelistedCurrencies(["¿USD"]);
      expect(filter.accept(BUSD)).toBe(true);
      expect(filter.accept(USDT)).toBe(false);
    });

    it("takes plain codes and patterns together", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["BTC", "¿USD"]);
      expect(filter.accept(BTC)).toBe(true);
      expect(filter.accept(BUSD)).toBe(true);
      expect(filter.accept(ETH)).toBe(false);
      expect([...(filter.getWhitelistedCurrencies() ?? [])]).toEqual(["BTC"]);
      expect([...(filter.getWhitelistedCurrencyPatterns() ?? [])]).toEqual(["¿USD"]);
    });

    it("a list made only of patterns still enforces them", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["¿USD"]);
      expect(filter.getWhitelistedCurrencies()?.size).toBe(0);
      expect(filter.accept(BTC)).toBe(false);
    });

    it("setting it again replaces the earlier list", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["BTC"]);
      filter.setWhitelistedCurrencies(["ETH"]);
      expect(filter.accept(BTC)).toBe(false);
      expect(filter.accept(ETH)).toBe(true);
    });
  });

  describe("blacklist", () => {
    it("rejects the listed assets and lets the rest through", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setBlacklistedCurrencies(["ETH"]);
      expect(filter.accept(ETH)).toBe(false);
      expect(filter.accept(BTC)).toBe(true);
      expect(filter.isBlacklisted(ETH)).toBe(true);
    });

    it("an empty list that was set rejects nothing", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setBlacklistedCurrencies([]);
      expect(filter.accept(BTC)).toBe(true);
    });

    it("matches wildcard patterns", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setBlacklistedCurrencies(["¿USD", "DOGE"]);
      expect(filter.accept(BUSD)).toBe(false);
      expect(filter.accept(Asset.of("DOGE"))).toBe(false);
      expect(filter.accept(USDT)).toBe(true);
    });
  });

  describe("both lists", () => {
    it("the blacklist wins over the whitelist", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["BTC", "ETH"]);
      filter.setBlacklistedCurrencies(["ETH"]);
      expect(filter.accept(BTC)).toBe(true);
      expect(filter.accept(ETH)).toBe(false);
      expect(filter.accept(USDT)).toBe(false);
    });

    it("a pattern in the blacklist removes what a plain code in the whitelist allowed", () => {
      const filter = new StrategyCurrencyFilter();
      filter.setWhitelistedCurrencies(["BUSD", "BTC"]);
      filter.setBlacklistedCurrencies(["¿USD"]);
      expect(filter.accept(BUSD)).toBe(false);
      expect(filter.accept(BTC)).toBe(true);
    });
  });
});
