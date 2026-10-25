import { describe, it, expect } from "vitest";
import { DistanceFromMaRTIndicator } from "$indicators/DistanceFromMaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("DistanceFromMaRTIndicator", () => {
  // SmaRTIndicator(3) in discrete mode:
  // update(10) => 10 (init)
  // update(20) => 10 (retains prev until period ends)
  // update(30) => 20 (period complete: (10+20+30)/3 = 20)
  // Distance = (close - ma) / ma

  it("testUpdate", () => {
    const distance = DistanceFromMaRTIndicator.sma(3);
    expect(distance.update(10)).toBeCloseTo(0, 10);   // ma=10, (10-10)/10 = 0
    expect(distance.update(20)).toBeCloseTo(1, 10);   // ma=10, (20-10)/10 = 1
    expect(distance.update(30)).toBeCloseTo(0.5, 10); // ma=20, (30-20)/20 = 0.5
  });

  it("testIsReady", () => {
    const distance = DistanceFromMaRTIndicator.sma(3);
    expect(distance.isReady()).toBe(false);
    distance.update(10);
    expect(distance.isReady()).toBe(false);
    distance.update(20);
    expect(distance.isReady()).toBe(false);
    distance.update(30);
    expect(distance.isReady()).toBe(true);
  });

  it("testEma", () => {
    const distance = DistanceFromMaRTIndicator.ema(3);
    expect(distance.update(10)).toBeCloseTo(0, 10);
  });

  it("testReset", () => {
    const distance = DistanceFromMaRTIndicator.sma(3);
    distance.update(10);
    distance.update(20);
    distance.reset();
    expect(distance.isReady()).toBe(false);
    expect(distance.getValue()).toBe(0);
  });


  describe("readiness", () => {
    it("is ready when the moving average is", () => {
      const sma = new SmaRTIndicator(4);
      const distance = new DistanceFromMaRTIndicator(sma);

      for (let tick = 1; tick <= 8; tick++) {
        distance.update(100 + tick);
        expect(distance.isReady(), `tick ${tick}`).toBe(sma.isReady());
        expect(distance.isReady(), `tick ${tick}`).toBe(tick >= 4);
      }
    });

    it("is not ready again after a reset", () => {
      const sma = new SmaRTIndicator(4);
      const distance = new DistanceFromMaRTIndicator(sma);
      for (let tick = 1; tick <= 8; tick++) distance.update(100 + tick);
      expect(distance.isReady()).toBe(true);

      distance.reset();

      expect(distance.isReady()).toBe(false);
      expect(sma.isReady()).toBe(false);
    });
  });
});
