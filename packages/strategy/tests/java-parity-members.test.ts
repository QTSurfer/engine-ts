import { describe, it, expect } from "vitest";
import { AbstractStrategy } from "../src/AbstractStrategy";
import { AbstractSubscriptionStrategy } from "../src/AbstractSubscriptionStrategy";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { AbstractKlineStrategy } from "../src/AbstractKlineStrategy";
import { StrategyCurrencyFilter } from "../src/StrategyCurrencyFilter";
import { EngineVersion } from "../src/EngineVersion";
import { ConvertHelper } from "../src/ConvertHelper";
import { RESERVED_PROPERTY_KEYS } from "../src/ReservedPropertyKeys";
import { StrategyPropertyDef } from "../src/StrategyPropertyDef";
import { StrategyPropertyManager } from "../src/StrategyPropertyManager";

function methodsOf(type: { prototype: object }): string[] {
  const names: string[] = [];
  for (let proto = type.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== "constructor" && typeof (proto as Record<string, unknown>)[name] === "function") {
        names.push(name);
      }
    }
  }
  return names;
}

function expectMembers(type: { prototype: object }, expected: string[]): void {
  const have = new Set(methodsOf(type));
  expect(expected.filter((name) => !have.has(name))).toEqual([]);
}

/**
 * The member names of the Java strategy classes that this port carries, by the Java class they
 * come from. A rename on either side shows up here first.
 */
describe("Java parity: member names", () => {
  it("AbstractStrategy", () => {
    expectMembers(AbstractStrategy, [
      "getExecutionMode",
      "setExecutionMode",
      "setMultiEntryEnabled",
      "getCurrencyFilter",
      "setCurrencyFilter",
      "setWhitelistedCurrencies",
      "setBlacklistedCurrencies",
      "setPercentGain",
      "getPercentGain",
      "setMinGain",
      "getMinGain",
      "getInputCurrency",
      "getOutputCurrency",
      "getEngineVersion",
      "getEngineVersionMajor",
      "getEngineVersionMinor",
      "getMinPercentGainMultiplier",
      "acceptCurrency",
      // the property API: setProperty and applyProperty are the one typed path here, see the
      // property tests; getPropertyInfos/getPropertyInfo/registerPropertyInfo are renamed
      "setProperty",
      "applyProperty",
      "hasProperty",
      "getProperty",
      "getPropertyDefs",
      "getPropertyDef",
      "registerProperty",
      "ensureDefaultsApplied",
      // no Java member: the scan of @StrategyProperty, as a call from the constructor
      "declareProperties",
    ]);
  });

  /**
   * Java member -> member here, for the property model. A member Java has and this port leaves
   * out is listed in the changeset (notices, nested bean paths, Float and List conversions).
   */
  it("the property model", () => {
    const manager: [javaMember: string, member: string][] = [
      ["StrategyPropertyManager.registerPropertyInfo", "register"],
      ["StrategyPropertyManager.scanAndRegisterAnnotations", "declare"],
      ["StrategyPropertyManager.applyProperty", "apply"],
      ["StrategyPropertyManager.hasProperty", "has"],
      ["StrategyPropertyManager.getProperty", "get"],
      ["StrategyPropertyManager.getPropertyInfos", "defs"],
      ["StrategyPropertyManager.getPropertyInfo", "def"],
      ["StrategyPropertyManager.ensureDefaultsApplied", "ensureDefaultsApplied"],
    ];
    expectMembers(StrategyPropertyManager, manager.map(([, member]) => member));

    const def = new StrategyPropertyDef({ name: "p", type: "int" });
    const attributes: [javaMember: string, member: string][] = [
      ["StrategyProperty.name", "name"],
      ["StrategyProperty.description", "description"],
      ["StrategyProperty.defaultValue", "defaultValue"],
      ["StrategyProperty.reflected", "reflected"],
      ["StrategyProperty.min", "min"],
      ["StrategyProperty.max", "max"],
      ["StrategyProperty.step", "step"],
      ["PropertyInfo.getType", "type"],
      ["PropertyInfo.getBeanProperty", "field"],
    ];
    expect(attributes.map(([, member]) => member).filter((member) => !(member in def))).toEqual([]);
    expect(String(def)).toBe("p");

    expect(typeof ConvertHelper.convert).toBe("function");
    expect(typeof ConvertHelper.isParsable).toBe("function");
  });

  it("the reserved keys of ReservedParamKeys.FALLBACK", () => {
    const fallback = [
      "amnt", "name", "enabled", "multiEntry", "multiEntryEnabled", "enableIndicatorsSignals", "lockPcnt", "minPcnt",
      "minGain", "whitelist", "blacklist", "backtestEnabled", "backtestFakeExecution", "backtestFunding",
      "backtestFeeRate", "maxConsecutiveLosses", "reentryCooldownMs", "maxConcurrentPositions", "maxDailyLoss",
    ];
    expect(fallback.filter((key) => !RESERVED_PROPERTY_KEYS.has(key))).toEqual([]);
  });

  it("AbstractSubscriptionStrategy", () => {
    expectMembers(AbstractSubscriptionStrategy, [
      "acceptInstrument",
      "isEnableIndicatorsSignals",
      "setEnableIndicatorsSignals",
    ]);
  });

  it.each([
    ["AbstractTickerStrategy", AbstractTickerStrategy],
    ["AbstractKlineStrategy", AbstractKlineStrategy],
  ])("%s", (_name, type) => {
    expectMembers(type, ["accept", "acceptInstrument", "update"]);
  });

  it("StrategyCurrencyFilter", () => {
    expectMembers(StrategyCurrencyFilter, [
      "getWhitelistedCurrencies",
      "getWhitelistedCurrencyPatterns",
      "getBlacklistedCurrencies",
      "getBlacklistedCurrencyPatterns",
      "setWhitelistedCurrencies",
      "setBlacklistedCurrencies",
      "accept",
      "isWhitelisted",
      "isBlacklisted",
    ]);
  });

  it("EngineVersion", () => {
    expect(Object.keys(EngineVersion).sort()).toEqual(
      ["UNKNOWN", "UNKNOWN_COMPONENT", "get", "getMajor", "getMinor", "getPatch"].sort(),
    );
  });
});
