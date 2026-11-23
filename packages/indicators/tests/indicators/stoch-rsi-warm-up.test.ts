import { describe, expect, it } from "vitest";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { StochasticRsiRTIndicator } from "$indicators/StochasticRsiRTIndicator";

// The stochastic RSI ranks the RSI inside a window of its own values. An RSI that is warming up says
// 0 and not an RSI, so it must stay out of that window: the indicator is ready, and equal to the
// definition, once the window holds `periods` valid values.

const BARS = 90;
const PERIODS = 14;

const prices = Array.from({ length: BARS }, (_, i) => 100 + 12 * Math.sin(i / 5) + 3 * Math.cos(i / 1.7) + i * 0.3);

describe("StochasticRsiRTIndicator warm-up", () => {
  it("is ready and equal to the definition once the window holds valid RSI values", () => {
    const reference = new RsiRTIndicator(PERIODS, null, true);
    const rsi = new Array<number>(BARS).fill(0);
    let firstValidRsi = -1;
    const stochastic = new StochasticRsiRTIndicator(PERIODS);

    for (let i = 0; i < BARS; i++) {
      stochastic.update(prices[i]!);
      rsi[i] = reference.update(prices[i]!);
      if (firstValidRsi < 0 && reference.isReady()) {
        firstValidRsi = i;
      }
      const valid = firstValidRsi >= 0 && i >= firstValidRsi + PERIODS - 1;
      expect(stochastic.isReady(), `ready at update ${i + 1}`).toBe(valid);
      if (valid) {
        const window = rsi.slice(i - PERIODS + 1, i + 1);
        const low = Math.min(...window);
        const high = Math.max(...window);
        const expected = rsi[i]! - low === 0 || high - low === 0 ? 0 : (100 * (rsi[i]! - low)) / (high - low);
        expect(stochastic.getValue(), `StochRSI at update ${i + 1}`).toBeCloseTo(Math.min(100, Math.max(0, expected)), 9);
      }
    }
    expect(firstValidRsi, "the RSI became ready").toBeGreaterThan(0);
  });

  it("over another indicator is ready one window after its RSI is", () => {
    const source = new SmaRTIndicator(5);
    const stochastic = new StochasticRsiRTIndicator(2, source);

    for (let tick = 1; tick <= 12; tick++) {
      stochastic.update(100 + tick);

      expect(source.isReady(), `source at tick ${tick}`).toBe(tick >= 5);
      // the RSI is ready with its source, at tick 5, and the window of 2 holds 2 valid RSI values at tick 6
      expect(stochastic.isReady(), `StochRSI at tick ${tick}`).toBe(tick >= 6);
    }
  });

  it("starts the warm-up again after a reset", () => {
    const stochastic = new StochasticRsiRTIndicator(PERIODS);
    prices.forEach((price) => stochastic.update(price));
    expect(stochastic.isReady()).toBe(true);

    stochastic.reset();
    stochastic.update(prices[0]!);

    expect(stochastic.isReady()).toBe(false);
  });
});
