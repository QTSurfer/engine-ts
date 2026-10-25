import { describe, it, expect } from "vitest";
import { ConvertHelper } from "../../src/ConvertHelper";
import type { StrategyPropertyType } from "../../src/StrategyPropertyDef";

const convert = (value: unknown, type: StrategyPropertyType) => ConvertHelper.convert(value, type);

describe("ConvertHelper, after the Java engine's", () => {
  describe("int", () => {
    it.each([
      [14, 14],
      [14.7, 14],
      [-14.7, -14],
      ["14", 14],
      ["-3", -3],
      ["14.7", 14],
      ["-14.7", -14],
      [".5", 0],
      ["007", 7],
    ])("%j is %j", (value, expected) => {
      expect(convert(value, "int")).toBe(expected);
    });

    it("truncates toward zero without leaving a negative zero", () => {
      expect(Object.is(convert(-0.5, "int"), 0)).toBe(true);
    });

    it("saturates at the 32-bit limits and reads NaN as 0, as a Java narrowing does", () => {
      expect(convert(2 ** 40, "int")).toBe(2147483647);
      expect(convert(-(2 ** 40), "int")).toBe(-2147483648);
      expect(convert("99999999999", "int")).toBe(2147483647);
      expect(convert(NaN, "int")).toBe(0);
    });

    it.each(["abc", "", " 5", "5 ", "+5", "1e3", "0x10", "5.", "-", ".", "1.2.3", "1,5", true, {}, []])(
      "refuses %j",
      (value) => {
        expect(convert(value, "int")).toBeUndefined();
      },
    );
  });

  describe("long and duration", () => {
    it.each(["long", "duration"] as const)("%s takes what an int takes, with the 64-bit limits", (type) => {
      expect(convert("3000000000", type)).toBe(3_000_000_000);
      expect(convert(1.9, type)).toBe(1);
      expect(convert("86400000.9", type)).toBe(86_400_000);
      expect(convert(2 ** 70, type)).toBe(2 ** 63);
      expect(convert(-(2 ** 70), type)).toBe(-(2 ** 63));
      expect(convert("x", type)).toBeUndefined();
      expect(convert(false, type)).toBeUndefined();
    });
  });

  describe("double", () => {
    it.each([
      [1.5, 1.5],
      [3, 3],
      ["1.5", 1.5],
      ["-.5", -0.5],
      [".5", 0.5],
      ["14", 14],
    ])("%j is %j", (value, expected) => {
      expect(convert(value, "double")).toBe(expected);
    });

    it("reads a bigint as a number", () => {
      expect(convert(7n, "double")).toBe(7);
      expect(convert(5n, "int")).toBe(5);
    });

    it("keeps a NaN or an infinity that is a number", () => {
      expect(convert(NaN, "double")).toBeNaN();
      expect(convert(Infinity, "double")).toBe(Infinity);
    });

    it.each(["abc", "", "5.", "1e-3", "1,5", "NaN", "Infinity", true])("refuses %j", (value) => {
      expect(convert(value, "double")).toBeUndefined();
    });
  });

  describe("boolean", () => {
    it("keeps a boolean", () => {
      expect(convert(true, "boolean")).toBe(true);
      expect(convert(false, "boolean")).toBe(false);
    });

    it.each(["true", "TRUE", "True"])("reads %j as true", (value) => {
      expect(convert(value, "boolean")).toBe(true);
    });

    it("never fails: whatever is not the text true is false", () => {
      for (const value of ["false", "yes", "on", "1", " true", "", 1, 0, 14, {}, []]) {
        expect(convert(value, "boolean")).toBe(false);
      }
    });
  });

  describe("String", () => {
    it("keeps a string", () => {
      expect(convert("BTC/USDT", "String")).toBe("BTC/USDT");
      expect(convert("", "String")).toBe("");
    });

    it("has no converter for a number or a boolean, which are refused", () => {
      expect(convert(5, "String")).toBeUndefined();
      expect(convert(true, "String")).toBeUndefined();
    });
  });

  it("converts no null or undefined, whatever the type", () => {
    for (const type of ["int", "long", "double", "boolean", "String", "duration"] as const) {
      expect(convert(null, type)).toBeUndefined();
      expect(convert(undefined, type)).toBeUndefined();
    }
  });

  it("isParsable is Apache's NumberUtils.isParsable", () => {
    for (const text of ["14", "-14", "14.5", "-14.5", ".5", "-.5", "0", "007"]) {
      expect(ConvertHelper.isParsable(text)).toBe(true);
    }
    for (const text of ["", "-", ".", "5.", "+5", "1e3", "0x1F", " 5", "1.2.3", "--5", "5-", "NaN"]) {
      expect(ConvertHelper.isParsable(text)).toBe(false);
    }
  });
});
