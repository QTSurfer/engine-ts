import { describe, it, expect } from "vitest";
import { Duration } from "$core/Duration";

describe("Duration", () => {
  it("is built from milliseconds, seconds or minutes, and reads back as milliseconds", () => {
    expect(Duration.ofMillis(1500).toMillis()).toBe(1500);
    expect(Duration.ofSeconds(900).toMillis()).toBe(900_000);
    expect(Duration.ofMinutes(15).toMillis()).toBe(900_000);
  });

  it("compares and equals by length", () => {
    expect(Duration.ofSeconds(900).equals(Duration.ofMinutes(15))).toBe(true);
    expect(Duration.ofSeconds(900).equals(Duration.ofSeconds(901))).toBe(false);
    expect(Duration.ofSeconds(900).equals(900_000)).toBe(false);
    expect(Duration.ofSeconds(1).compareTo(Duration.ofMillis(999))).toBeGreaterThan(0);
    expect(Duration.ofSeconds(1).compareTo(Duration.ofMillis(1000))).toBe(0);
    expect(Duration.ofSeconds(1).compareTo(Duration.ofMillis(1001))).toBeLessThan(0);
  });

  it("is a plain value, as in Java: zero and negative amounts exist", () => {
    expect(Duration.ofSeconds(0).toMillis()).toBe(0);
    expect(Duration.ofSeconds(-2).toMillis()).toBe(-2000);
  });

  it("takes whole numbers only, as Java's long parameters do", () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => Duration.ofMillis(bad), String(bad)).toThrow(/whole number/);
      expect(() => Duration.ofSeconds(bad), String(bad)).toThrow(/whole number/);
      expect(() => Duration.ofMinutes(bad), String(bad)).toThrow(/whole number/);
    }
    expect(() => Duration.ofMinutes(Number.MAX_SAFE_INTEGER)).toThrow(/whole number/);
  });
});
