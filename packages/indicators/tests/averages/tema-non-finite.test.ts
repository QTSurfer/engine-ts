import { describe, expect, it } from "vitest";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";

/**
 * A price that is not finite (NaN or an infinity) is ignored: nothing is updated and the previous
 * value is returned, as the other exponential averages and the indicators built on them do. The
 * triple exponential average used to pass it on: its first average dropped it and returned its
 * current value, and the other two took that as a new value, so a first update of NaN started them
 * from 0 and one in the middle gave them a tick twice.
 */

const CLOSES = [100, 101.5, 99.8, 102.2, 103.9, 101.1, 100.4, 104.8, 106.2, 105.1, 107.3, 108.8];

/** The values of the indicator over the finite closes only. */
function clean(periods: number): number[] {
  const tema = new TemaRTIndicator(periods);
  return CLOSES.map((close) => tema.update(close));
}

describe("TemaRTIndicator with an input that is not finite", () => {
  it("a first update that is not finite does not start the averages from zero", () => {
    const expected = clean(3);
    const tema = new TemaRTIndicator(3);

    expect(tema.update(Number.NaN)).toBe(0);
    CLOSES.forEach((close, i) => {
      expect(tema.update(close), `update ${i + 1}`).toBe(expected[i]);
    });
  });

  it("an input that is not finite in the middle holds the value and leaves the averages alone", () => {
    const expected = clean(3);
    const notFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const tema = new TemaRTIndicator(3);

    CLOSES.forEach((close, i) => {
      expect(tema.update(close), `update ${i + 1}`).toBe(expected[i]);
      for (const bad of notFinite) {
        expect(tema.update(bad), `held after ${bad} following update ${i + 1}`).toBe(expected[i]);
      }
    });
  });
});
