import { describe, it, expect } from "vitest";
import { DistanceFromMaRTIndicator } from "$indicators/DistanceFromMaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { WmaRTIndicator } from "$averages/WmaRTIndicator";
import { WmaIncrementalRTIndicator } from "$averages/WmaIncrementalRTIndicator";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";
import { KamaRTIndicator } from "$averages/KamaRTIndicator";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

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
  it("accepts every moving average, and a read-only view of each", () => {
    const averages: RTIndicator[] = [
      new SmaRTIndicator(5),
      new EmaRTIndicator(5),
      new MmaRTIndicator(5),
      new WmaRTIndicator(5),
      new WmaIncrementalRTIndicator(5),
      new HmaRTIndicator(5),
      new TemaRTIndicator(5),
      new KamaRTIndicator(),
    ];
    for (const average of averages) {
      expect(() => new DistanceFromMaRTIndicator(average), average.getId!()).not.toThrow();
      expect(
        () => new DistanceFromMaRTIndicator(new ReadOnlyRTIndicator(average)),
        `a read-only view of ${average.getId!()}`,
      ).not.toThrow();
    }
  });

  it("refuses an indicator that is not a moving average, even behind a view", () => {
    const rsi = new RsiRTIndicator();

    expect(() => new DistanceFromMaRTIndicator(rsi)).toThrow("Not a moving average indicator: rsi");
    expect(() => new DistanceFromMaRTIndicator(new ReadOnlyRTIndicator(rsi))).toThrow(
      "Not a moving average indicator: rsi",
    );
  });

  it("is accepted by the group for any registered average and refused for the rest", () => {
    const group = new InstrumentGroupRTIndicator("BTC/USDT")
      .addPrice()
      .sma("sma", 3)
      .wma("wma", 3)
      .hma("hma", 4)
      .tema("tema", 3)
      .kama("kama", 2, 2, 30)
      .rsi("rsi", 14);

    for (const name of ["sma", "wma", "hma", "tema", "kama"]) {
      expect(() => group.distanceMa(`dist-${name}`, name), name).not.toThrow();
    }
    expect(() => group.distanceMa("dist-rsi", "rsi")).toThrow("Not a moving average indicator: rsi");
    expect(group.get("dist-rsi"), "nothing is registered by a refused call").toBeUndefined();
  });
});
