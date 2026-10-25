import { describe, it, expect } from "vitest";
import { BiFunctionRTIndicator } from "$numeric/BiFunctionRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ConstantRTIndicator } from "$numeric/ConstantRTIndicator";

describe("BiFunctionRTIndicator", () => {
  // SmaRTIndicator() with no periods:
  // update(1) => 1, update(2) => 1.5
  // ConstantRTIndicator.of(N) always returns N regardless of update input

  it("testPlus", () => {
    const bi = BiFunctionRTIndicator.plus(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(10),
    );
    expect(bi.update(1)).toBeCloseTo(11, 10);   // 1 + 10
    expect(bi.update(2)).toBeCloseTo(11.5, 10); // 1.5 + 10
  });

  it("testMinus", () => {
    const bi = BiFunctionRTIndicator.minus(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(10),
    );
    expect(bi.update(1)).toBeCloseTo(-9, 10);   // 1 - 10
    expect(bi.update(2)).toBeCloseTo(-8.5, 10); // 1.5 - 10
  });

  it("testMultiply", () => {
    const bi = BiFunctionRTIndicator.multiply(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(10),
    );
    expect(bi.update(1)).toBeCloseTo(10, 10);   // 1 * 10
    expect(bi.update(2)).toBeCloseTo(15, 10);   // 1.5 * 10
  });

  it("testDivide", () => {
    const bi = BiFunctionRTIndicator.divide(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(2),
    );
    expect(bi.update(1)).toBeCloseTo(0.5, 10);  // 1 / 2
    expect(bi.update(2)).toBeCloseTo(0.75, 10); // 1.5 / 2
  });

  it("testDivideByZero", () => {
    const bi = BiFunctionRTIndicator.divide(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(0),
    );
    expect(bi.update(1)).toBeCloseTo(0, 10);
  });

  it("divides to 0 whenever the quotient is not finite, as the Java engine does", () => {
    expect(BiFunctionRTIndicator.divide(ConstantRTIndicator.of(NaN), ConstantRTIndicator.of(2)).update(1)).toBe(0);
    expect(BiFunctionRTIndicator.divide(ConstantRTIndicator.of(Infinity), ConstantRTIndicator.of(2)).update(1)).toBe(0);
    expect(BiFunctionRTIndicator.divide(ConstantRTIndicator.of(1e308), ConstantRTIndicator.of(1e-10)).update(1)).toBe(0);
  });

  it("testMax", () => {
    const bi = BiFunctionRTIndicator.max(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(1.25),
    );
    expect(bi.update(1)).toBeCloseTo(1.25, 10); // max(1, 1.25) = 1.25
    expect(bi.update(2)).toBeCloseTo(1.5, 10);  // max(1.5, 1.25) = 1.5
  });

  it("testMin", () => {
    const bi = BiFunctionRTIndicator.min(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(1.25),
    );
    expect(bi.update(1)).toBeCloseTo(1, 10);    // min(1, 1.25) = 1
    expect(bi.update(2)).toBeCloseTo(1.25, 10); // min(1.5, 1.25) = 1.25
  });

  it("testReset", () => {
    const bi = BiFunctionRTIndicator.plus(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(10),
    );
    expect(bi.update(1)).toBeCloseTo(11, 10);
    bi.reset();
    expect(bi.getValue()).toBe(0);
    expect(bi.update(1)).toBeCloseTo(11, 10);
  });


  describe("readiness", () => {
    it("is ready when both operands are", () => {
      const fast = new SmaRTIndicator(3);
      const slow = new SmaRTIndicator(5);
      const bi = BiFunctionRTIndicator.minus(fast, slow);

      for (let tick = 1; tick <= 8; tick++) {
        bi.update(100 + tick);
        expect(bi.isReady(), `tick ${tick}`).toBe(fast.isReady() && slow.isReady());
        expect(bi.isReady(), `tick ${tick}`).toBe(tick >= 5);
      }
    });

    it("is not ready again after a reset", () => {
      const fast = new SmaRTIndicator(3);
      const slow = new SmaRTIndicator(5);
      const bi = BiFunctionRTIndicator.plus(fast, slow);
      for (let tick = 1; tick <= 8; tick++) bi.update(100 + tick);
      expect(bi.isReady()).toBe(true);

      bi.reset();

      expect(bi.isReady()).toBe(false);
      expect(bi.getValue()).toBe(0);
      for (let tick = 1; tick <= 4; tick++) {
        bi.update(100 + tick);
        expect(bi.isReady(), `tick ${tick} after reset`).toBe(false);
      }
      bi.update(105);
      expect(bi.isReady()).toBe(true);
    });

    it("is ready from the start over plain values", () => {
      const bi = BiFunctionRTIndicator.plus(ConstantRTIndicator.of(1), ConstantRTIndicator.of(2));

      expect(bi.isReady()).toBe(true);
    });
  });
});
