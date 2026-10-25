import { describe, it, expect } from "vitest";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";

describe("BollingerBandWidthRTIndicator", () => {
  it("testBandWidthFormula", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    for (let i = 1; i <= 10; i++) {
      bb.update(i * 10);
    }
    const bw = bb.getBandWidth();
    const middle = bb.getValue();
    const upper = bb.getUpper().getValue();
    const lower = bb.getLower().getValue();
    expect(bw.getValue()).toBeCloseTo(100 * (upper - lower) / middle, 5);
  });

  it("testBandWidthPositive", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    const values = [10, 20, 30, 40, 50];
    for (const v of values) {
      bb.update(v);
    }
    expect(bb.getBandWidth().getValue()).toBeGreaterThan(0.0);
  });

  it("testBandWidthWidensWithVolatility", () => {
    const bbLow = new BollingerBandsRTIndicator(5, 2);
    const bbHigh = new BollingerBandsRTIndicator(5, 2);

    const lowVol = [100, 101, 100, 101, 100];
    const highVol = [100, 120, 80, 130, 70];

    for (let i = 0; i < 5; i++) {
      bbLow.update(lowVol[i]);
      bbHigh.update(highVol[i]);
    }

    expect(bbHigh.getBandWidth().getValue()).toBeGreaterThan(
      bbLow.getBandWidth().getValue(),
    );
  });

  it("testUpdateDelegatesToGetValue", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    for (let i = 1; i <= 5; i++) {
      bb.update(i * 10);
    }
    const bw = bb.getBandWidth();
    const updateResult = bw.update(60);
    expect(updateResult).toBe(bw.getValue());
  });

  it("testViaGetBandWidth", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    for (let i = 1; i <= 6; i++) {
      bb.update(i * 10);
    }
    expect(bb.getBandWidth().getValue()).toBeGreaterThan(0);
  });

  it("is 0 on a zero middle band, as the Java engine gives", () => {
    const bb = new BollingerBandsRTIndicator(2, 2);
    bb.update(-1);
    bb.update(1);
    expect(bb.getBandWidth().getValue()).toBe(0);
  });
});
