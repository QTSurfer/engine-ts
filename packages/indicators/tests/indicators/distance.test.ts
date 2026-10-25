import { describe, it, expect } from "vitest";
import { DistanceRTIndicator } from "$indicators/DistanceRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ConstantRTIndicator } from "$numeric/ConstantRTIndicator";

describe("DistanceRTIndicator", () => {
  // DistanceRTIndicator computes (a - b) / b
  // SmaRTIndicator() no-periods: update(1)=1, update(2)=1.5
  // ConstantRTIndicator.of(10) always returns 10

  it("testUpdate", () => {
    const distance = new DistanceRTIndicator(
      new SmaRTIndicator(),
      ConstantRTIndicator.of(10),
    );
    expect(distance.update(1)).toBeCloseTo(-0.9, 10);  // (1 - 10) / 10
    expect(distance.update(2)).toBeCloseTo(-0.85, 10); // (1.5 - 10) / 10
  });

  it("testUpdateWithSameSma", () => {
    // Same SMA instance is updated twice per distance.update() call
    // First call: a=sma.update(1)=1, b=sma.update(1)=(1+1)/2=1, distance=0
    // Second call: a=sma.update(2)=(1+2)/2=1.5, b=sma.update(2)=(1.5+2)/2=1.75
    const sma = new SmaRTIndicator();
    const distance = new DistanceRTIndicator(sma, sma);
    expect(distance.update(1)).toBeCloseTo(0, 10);
    expect(distance.update(2)).toBeCloseTo((1.5 - 1.75) / 1.75, 10);
  });


  describe("readiness", () => {
    it("is ready when both sources are", () => {
      const fast = new SmaRTIndicator(3);
      const slow = new SmaRTIndicator(5);
      const distance = new DistanceRTIndicator(fast, slow);

      for (let tick = 1; tick <= 8; tick++) {
        distance.update(100 + tick);
        expect(distance.isReady(), `tick ${tick}`).toBe(fast.isReady() && slow.isReady());
        expect(distance.isReady(), `tick ${tick}`).toBe(tick >= 5);
      }
    });

    it("waits for the slower source on either side", () => {
      const slow = new SmaRTIndicator(5);
      const fast = new SmaRTIndicator(3);
      const distance = new DistanceRTIndicator(slow, fast);

      for (let tick = 1; tick <= 4; tick++) {
        distance.update(100 + tick);
        expect(distance.isReady(), `tick ${tick}`).toBe(false);
      }
      distance.update(105);
      expect(distance.isReady()).toBe(true);
    });

    it("keeps the relative distance as its value during warm-up", () => {
      const fast = new SmaRTIndicator(3);
      const slow = new SmaRTIndicator(5);
      const distance = new DistanceRTIndicator(fast, slow);

      distance.update(100);
      distance.update(110);

      expect(distance.isReady()).toBe(false);
      expect(distance.getValue()).toBe((fast.getValue() - slow.getValue()) / slow.getValue());
    });

    it("is not ready again after a reset", () => {
      const fast = new SmaRTIndicator(3);
      const slow = new SmaRTIndicator(5);
      const distance = new DistanceRTIndicator(fast, slow);
      for (let tick = 1; tick <= 8; tick++) distance.update(100 + tick);
      expect(distance.isReady()).toBe(true);

      distance.reset();

      expect(distance.isReady()).toBe(false);
      expect(distance.getValue()).toBe(0);
      for (let tick = 1; tick <= 4; tick++) {
        distance.update(100 + tick);
        expect(distance.isReady(), `tick ${tick} after reset`).toBe(false);
      }
      distance.update(105);
      expect(distance.isReady()).toBe(true);
    });
  });
});
