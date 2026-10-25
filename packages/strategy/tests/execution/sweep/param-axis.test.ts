import { describe, it, expect } from "vitest";
import { ParamAxis } from "../../../src/execution/sweep/ParamAxis";
import type { PropertyHints } from "../../../src/execution/sweep/PropertyHints";

// Mirrors the canonical engine's ParamAxisTest (8 behaviors), adapted to
// vitest idioms. See ParamAxis.ts for why the underlying lattice math
// doesn't need a BigDecimal-equivalent dependency to stay float-safe.
describe("ParamAxis", () => {
  it("float lattice is float-safe: 0.5..3.0 step 0.1 yields 26 points", () => {
    const axis = ParamAxis.range("stop.pct", 0.5, 3.0, 0.1);
    expect(axis.size()).toBe(26);
    expect(axis.valueAt(0)).toBe(0.5);
    expect(axis.valueAt(25)).toBe(3.0);
    // No accumulated float drift: each point snaps to the lattice within 1e-9.
    for (let i = 0; i < axis.size(); i++) {
      const expected = 0.5 + i * 0.1;
      expect(axis.valueAt(i) as number).toBeCloseTo(expected, 9);
    }
  });

  it("integer range is inclusive on both ends", () => {
    const axis = ParamAxis.range("rsi.period", 1, 10, 1);
    expect(axis.size()).toBe(10);
    expect(axis.valueAt(0)).toBe(1);
    expect(axis.valueAt(9)).toBe(10);
  });

  it("single-point range when from equals to", () => {
    const axis = ParamAxis.range("x", 2.0, 2.0, 0.5);
    expect(axis.size()).toBe(1);
    expect(axis.valueAt(0)).toBe(2.0);
  });

  it("range not evenly divisible floors the trailing partial step", () => {
    // 0..1 step 0.3 -> 0.0, 0.3, 0.6, 0.9 (1.2 would overshoot) = 4 points.
    const axis = ParamAxis.range("x", 0.0, 1.0, 0.3);
    expect(axis.size()).toBe(4);
    expect(axis.valueAt(3) as number).toBeCloseTo(0.9, 9);
  });

  it("explicit values with mixed types are used verbatim", () => {
    const axis = ParamAxis.values("mode", [5, "fast", true]);
    expect(axis.size()).toBe(3);
    expect(axis.valueAt(0)).toBe(5);
    expect(axis.valueAt(1)).toBe("fast");
    expect(axis.valueAt(2)).toBe(true);
  });

  it("invalid range is rejected", () => {
    expect(() => ParamAxis.range("x", 1.0, 0.0, 0.1)).toThrow();
    expect(() => ParamAxis.range("x", 0.0, 1.0, 0.0)).toThrow();
    expect(() => ParamAxis.range("x", 0.0, 1.0, -0.1)).toThrow();
  });

  it("duplicate explicit values are rejected", () => {
    expect(() => ParamAxis.values("x", [1, 2, 1])).toThrow();
  });

  it("empty explicit values are rejected", () => {
    expect(() => ParamAxis.values("x", [])).toThrow();
  });
});

// Additional TS-only coverage for the standalone PropertyHints -> ParamAxis
// bridge (no canonical-engine counterpart pinned here; PropertyHints and
// ParamAxis/SweepExpander are separate, unconnected surfaces upstream too).
describe("ParamAxis.fromHints", () => {
  it("builds a range axis when min, max and step are all present", () => {
    const hints: PropertyHints = { min: 2, max: 50, step: 1 };
    const axis = ParamAxis.fromHints("rsi.period", hints);
    expect(axis.size()).toBe(49);
    expect(axis.valueAt(0)).toBe(2);
    expect(axis.valueAt(48)).toBe(50);
  });

  it("throws when any hint is missing", () => {
    expect(() => ParamAxis.fromHints("x", {})).toThrow();
    expect(() => ParamAxis.fromHints("x", { min: 1, max: 10 })).toThrow();
    expect(() => ParamAxis.fromHints("x", { min: 1, step: 1 })).toThrow();
    expect(() => ParamAxis.fromHints("x", { max: 10, step: 1 })).toThrow();
  });
});
