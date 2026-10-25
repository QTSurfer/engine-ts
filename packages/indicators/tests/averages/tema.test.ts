import { describe, it, expect } from "vitest";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("TemaRTIndicator", () => {
  it("testFirstValueIsInput", () => {
    const tema = new TemaRTIndicator(5);
    expect(tema.update(100.0)).toBeCloseTo(100.0, 3);
  });

  it("testKnownValues", () => {
    const tema = new TemaRTIndicator(5);
    for (let i = 0; i < 14; i++) {
      tema.update(CLOSE_PRICES_LIST[i]);
    }
    expect(tema.getValue()).toBeCloseTo(CLOSE_PRICES_LIST[13], 0);
  });

  it("testConstantInput", () => {
    const tema = new TemaRTIndicator(10);
    for (let i = 0; i < 30; i++) {
      tema.update(50.0);
    }
    expect(tema.getValue()).toBeCloseTo(50.0, 4);
  });

  it("testResetReproducibility", () => {
    const tema = new TemaRTIndicator(5);
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(tema.update(CLOSE_PRICES_LIST[i]));
    }

    tema.reset();
    for (let i = 0; i < 10; i++) {
      expect(tema.update(CLOSE_PRICES_LIST[i])).toBe(results[i]);
    }
  });

  it("testTrendingInputLessLagThanEma", () => {
    const tema = new TemaRTIndicator(5);
    const ema = new EmaRTIndicator(5);
    for (let i = 1; i <= 20; i++) {
      tema.update(i * 10);
      ema.update(i * 10);
    }
    expect(Math.abs(200 - tema.getValue())).toBeLessThan(Math.abs(200 - ema.getValue()));
  });
});
