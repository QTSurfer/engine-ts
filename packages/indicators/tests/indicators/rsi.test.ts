import { describe, it, expect } from "vitest";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("RsiRTIndicator", () => {
  it("testThatRsiValueIsAPercentage", () => {
    const rsi = new RsiRTIndicator(14);
    for (const price of CLOSE_PRICES_LIST) {
      const result = rsi.update(price);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("testFromFixturesClosingPricesList2PeriodsSMA", () => {
    const rsi = new RsiRTIndicator();
    for (let i = 0; i < 14; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(76.03, 1);
    expect(rsi.periodCycles).toBe(0);
  });

  it("testFromFixturesClosingPricesList14Periods", () => {
    const rsi = new RsiRTIndicator(14);
    for (let i = 0; i < 14; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(70.46, 1);
    expect(rsi.periodCycles).toBe(1);
  });

  it("testFromFixturesClosingPricesListAveragingWithMMA14Periods", () => {
    const rsi = new RsiRTIndicator(14, false);
    for (let i = 0; i < 14; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(71.8, 1);
    expect(rsi.periodCycles).toBe(1);
  });

  it("testFromFixturesClosingPricesList14Periods2Cycles", () => {
    const rsi = new RsiRTIndicator(14);
    for (let i = 0; i < 28; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(32.26, 1);
    expect(rsi.periodCycles).toBe(2);
  });

  it("testFromFixturesClosingPricesListAveragingWithMMA14Periods2Cycles", () => {
    const rsi = new RsiRTIndicator(14, false);
    for (let i = 0; i < 28; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(38.17, 1);
    expect(rsi.periodCycles).toBe(2);
  });

  it("testReset", () => {
    const rsi = new RsiRTIndicator(14);
    for (let i = 0; i < 14; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(70.46, 1);

    rsi.reset();
    expect(rsi.getValue()).toBe(0);
    expect(rsi.periodCycles).toBe(0);

    for (let i = 0; i < 14; i++) {
      rsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(rsi.getValue()).toBeCloseTo(70.46, 1);
  });

  // A series that does not move: RS is 0/0 and this indicator returns 0, as TA-Lib, ta4j and the Java engine
  // do (see the class documentation)
  describe("when nothing moves", () => {
    it("no movement at all reads 0 with either averaging", () => {
      for (const sma of [true, false]) {
        const rsi = new RsiRTIndicator(14, sma);
        for (let i = 0; i < 80; i++) {
          expect(rsi.update(100), `sma=${sma}, tick ${i}`).toBe(0);
          expect(rsi.getRelativeStrength(), `sma=${sma}, tick ${i}`).toBe(0);
        }
      }
    });

    it("only gains read 100 and only losses read 0", () => {
      for (const sma of [true, false]) {
        const rising = new RsiRTIndicator(14, sma);
        const falling = new RsiRTIndicator(14, sma);
        for (let i = 0; i < 80; i++) {
          const up = rising.update(100 + i);
          const down = falling.update(200 - i);
          if (i >= 14) {
            expect(up, `sma=${sma}, rising, tick ${i}`).toBe(100);
            expect(down, `sma=${sma}, falling, tick ${i}`).toBe(0);
          }
        }
      }
    });

    it("a plateau after a rise stays at 100 with Wilder's averaging", () => {
      // The average gain decays but is never 0, and there is no loss
      const rsi = new RsiRTIndicator(14, false);
      for (let i = 0; i < 80; i++) {
        const value = rsi.update(i < 30 ? 100 + i : 129);
        if (i >= 1) expect(value, `tick ${i}`).toBe(100);
      }
    });

    it("a plateau after a rise drops to 0 at the first quiet period with the simple averaging", () => {
      // The averages refresh at the end of each period of 14 ticks (13, 27, 41, 55, 69...). The last gain is
      // at tick 29, in the period that ends at 41; the period that ends at 55 holds none
      const rsi = new RsiRTIndicator(14, true);
      for (let i = 0; i < 80; i++) {
        const value = rsi.update(i < 30 ? 100 + i : 129);
        if (i >= 13 && i < 55) expect(value, `tick ${i}`).toBe(100);
        else if (i >= 55) expect(value, `tick ${i}`).toBe(0);
      }
    });
  });
});
