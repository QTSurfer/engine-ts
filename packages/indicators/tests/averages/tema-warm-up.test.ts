import { describe, expect, it } from "vitest";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";

/**
 * A triple exponential average is ready when each of its three averages has the `periods` values
 * of the one before it, so every average after the first adds `periods - 1` updates: update
 * `3 * (periods - 1) + 1`. It used to say it was ready at update `periods`, when only the first of
 * the three had its values. The values do not change: only the update from which the indicator
 * says its definition applies.
 *
 * Each value is computed here from plain arrays, and the indicator is compared at every update.
 */

const BARS = 200;
const TOLERANCE = 1e-9;

function closes(): number[] {
  return Array.from({ length: BARS }, (_, i) => 100 + 12 * Math.sin(i / 5) + 3 * Math.cos(i / 1.7) + i * 0.3);
}

/** The exponential average of the values, started from the first one, as the engine does. */
function ema(values: number[], periods: number): number[] {
  const alpha = 2 / (periods + 1);
  const out = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    out.push(out[i - 1]! + alpha * (values[i]! - out[i - 1]!));
  }
  return out;
}

describe("TemaRTIndicator warm-up", () => {
  it("is ready from the update where the third average has its values and not before", () => {
    const data = closes();
    for (const periods of [1, 2, 3, 5, 14, 20]) {
      const e1 = ema(data, periods);
      const e2 = ema(e1, periods);
      const e3 = ema(e2, periods);
      const readyAt = 3 * (periods - 1) + 1;
      const tema = new TemaRTIndicator(periods);

      for (let i = 0; i < BARS; i++) {
        tema.update(data[i]!);
        expect(tema.isReady(), `tema(${periods}) ready at update ${i + 1}`).toBe(i + 1 >= readyAt);
        expect(Math.abs(tema.getValue() - (3 * e1[i]! - 3 * e2[i]! + e3[i]!)), `tema(${periods}) at update ${i + 1}`).toBeLessThan(
          TOLERANCE,
        );
      }
    }
  });

  it("tema(14) is ready at update 40", () => {
    const data = closes();
    const tema = new TemaRTIndicator(14);
    for (let i = 0; i < 39; i++) tema.update(data[i]!);
    expect(tema.isReady()).toBe(false);
    tema.update(data[39]!);
    expect(tema.isReady()).toBe(true);
  });

  it("an input that is not finite does not count towards the warm-up", () => {
    const data = closes();
    const tema = new TemaRTIndicator(3); // ready at its 7th finite update
    for (let i = 0; i < 6; i++) {
      tema.update(data[i]!);
      tema.update(Number.NaN);
    }
    expect(tema.isReady()).toBe(false);

    tema.update(data[6]!);

    expect(tema.isReady()).toBe(true);
  });

  it("a reset starts the warm-up again", () => {
    const data = closes();
    const tema = new TemaRTIndicator(5);
    for (const close of data) tema.update(close);
    expect(tema.isReady()).toBe(true);

    tema.reset();

    for (let i = 0; i < 13; i++) {
      expect(tema.isReady(), `ready after ${i} updates of the second run`).toBe(false);
      tema.update(data[i]!);
    }
    expect(tema.isReady(), "ready at update 13, which is 3 * 4 + 1").toBe(true);
  });
});
