/**
 * Generates reproducible synthetic price data for benchmarks.
 * Port of com.wualabs.qtsurfer.engine.indicators.benchmark.BenchmarkPriceData
 *
 * Uses a seeded PRNG (same seed=42 as Java) to produce identical random walks.
 * Note: JS doesn't have java.util.Random, so we use a simple xoshiro128** PRNG
 * seeded deterministically. The actual values differ from Java but the statistical
 * properties (volatility, distribution) are equivalent.
 */

const SIZE = 10_000;
const SEED = 42;
const START_PRICE = 100.0;
const VOLATILITY = 0.005;

/**
 * Mulberry32 — simple 32-bit PRNG with good distribution.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: uniform [0,1) → standard normal.
 */
function gaussianFrom(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const val = spare;
      spare = null;
      return val;
    }
    let u: number, v: number, s: number;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

function generate(): Float64Array {
  const prices = new Float64Array(SIZE);
  const gaussian = gaussianFrom(mulberry32(SEED));
  prices[0] = START_PRICE;
  for (let i = 1; i < SIZE; i++) {
    const change = 1.0 + gaussian() * VOLATILITY;
    prices[i] = prices[i - 1] * change;
  }
  return prices;
}

const PRICES = generate();

export function prices(): Float64Array {
  return PRICES;
}

export { SIZE };
