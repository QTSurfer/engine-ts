import { describe, it, expect } from "vitest";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";

/**
 * What a consumer sees is the entry the group registered, not the class behind it: `distance`,
 * `distanceMa` and `percentChange` register a percent transform over the indicator, and the
 * Bollinger bands are read-only views of the parent's values. Every derived entry built by the
 * group is ready when the indicators it reads are, so a recorder that skips unready indicators
 * draws nothing for it while its sources are warming up.
 */
describe("derived entries of an instrument group", () => {
  const INSTRUMENT = "BTC/USDT";

  /** The slower of the two moving averages every derived entry reads. */
  const SLOW_WARMUP = 5;

  const SOURCES = ["fast", "slow", "bb"];
  const DERIVED = ["dist", "distMa", "chg", "diff", "smaOfSlow", "gainOfSlow", "bbUpper", "bbLower", "bbBW"];

  function group(): InstrumentGroupRTIndicator {
    return new InstrumentGroupRTIndicator(INSTRUMENT)
      .sma("fast", 3)
      .sma("slow", SLOW_WARMUP)
      .bollinger("bb", 5, 2)
      .distance("dist", "fast", "slow")
      .distanceMa("distMa", "slow")
      .percentChange("chg", "slow")
      .diff("diff", "fast", "slow")
      .sma("smaOfSlow", "slow", 2)
      .gain("gainOfSlow", "slow")
      .bollingerBandwidth("bb");
  }

  /** Feeds one point to every registered entry in registration order, sources first, as a tick does. */
  function tick(g: InstrumentGroupRTIndicator, price: number): void {
    g.indicators.forEachPublicable((_name, indicator) => {
      indicator.update(price);
    });
  }

  const ready = (g: InstrumentGroupRTIndicator, name: string): boolean => g.getExisting(name).isReady();

  it("are ready when their sources are", () => {
    const g = group();

    for (let t = 1; t <= 10; t++) {
      tick(g, 100 + t);

      expect(ready(g, "fast"), `fast at tick ${t}`).toBe(t >= 3);
      expect(ready(g, "slow"), `slow at tick ${t}`).toBe(t >= SLOW_WARMUP);
      for (const name of DERIVED) {
        expect(ready(g, name), `${name} at tick ${t}`).toBe(t >= SLOW_WARMUP);
      }
    }
  });

  it("resetting the group's indicators makes every entry not ready again", () => {
    const g = group();
    for (let t = 1; t <= 10; t++) tick(g, 100 + t);

    g.indicators.reset();

    for (const name of [...SOURCES, ...DERIVED]) {
      expect(ready(g, name), name).toBe(false);
    }
    for (let t = 1; t <= 10; t++) {
      tick(g, 100 + t);
      for (const name of DERIVED) {
        expect(ready(g, name), `${name} at tick ${t} after reset`).toBe(t >= SLOW_WARMUP);
      }
    }
  });

  it("resetting a derived entry leaves its registered sources alone", () => {
    const g = group();
    for (let t = 1; t <= 10; t++) tick(g, 100 + t);
    const fast = g.getExisting("fast").getValue();
    const slow = g.getExisting("slow").getValue();
    const upper = g.getExisting("bbUpper").getValue();

    for (const name of ["dist", "distMa", "chg", "diff", "smaOfSlow", "gainOfSlow", "bbBW"]) {
      g.getExisting(name).reset();
    }

    expect(ready(g, "fast")).toBe(true);
    expect(ready(g, "slow")).toBe(true);
    expect(ready(g, "bb")).toBe(true);
    expect(g.getExisting("fast").getValue()).toBe(fast);
    expect(g.getExisting("slow").getValue()).toBe(slow);
    expect(g.getExisting("bbUpper").getValue()).toBe(upper);
    // Still reading warm sources, the derived entries have nothing to wait for
    expect(ready(g, "dist")).toBe(true);
    expect(ready(g, "distMa")).toBe(true);
    expect(ready(g, "chg")).toBe(true);
    expect(ready(g, "diff")).toBe(true);
  });
});
