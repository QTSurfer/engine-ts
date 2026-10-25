/**
 * Generates reproducible synthetic price data for benchmarks.
 * Seeded PRNG random walk: 10,000 prices, seed=42, volatility=0.5%.
 */

const SIZE = 10_000;
const SEED = 42;
const START_PRICE = 100.0;
const VOLATILITY = 0.005;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    prices[i] = prices[i - 1] * (1.0 + gaussian() * VOLATILITY);
  }
  return prices;
}

const PRICES = generate();

export function prices(): Float64Array {
  return PRICES;
}

export { SIZE };
