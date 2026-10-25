// The dataset the Java engine's JMH benchmarks feed their indicators (`BenchmarkPriceData`), reproduced
// value for value: the same seeds through a port of `java.util.Random`, so both sides measure and
// check the same 10,000 values.
//
// Bit-for-bit only where `Math.log` is fdlibm's, as Java's `StrictMath.log` is: V8 (Node.js, Deno)
// ports fdlibm, JavaScriptCore does not. The runner therefore generates the file once, in Node.js,
// and every runtime reads it.

import { writeFileSync } from "node:fs";

export const SIZE = 10_000;
const SEED = 42n;
const START_PRICE = 100.0;
const VOLATILITY = 0.005;
const SERIES = ["prices", "opens", "highs", "lows", "closes", "volumes"];

const MULTIPLIER = 0x5deece66dn;
const ADDEND = 0xbn;
const MASK = (1n << 48n) - 1n;

/** `java.util.Random`: the 48-bit linear congruential generator and its legacy Gaussian. */
class JavaRandom {
  constructor(seed) {
    this.seed = (seed ^ MULTIPLIER) & MASK;
    this.nextNextGaussian = 0;
    this.haveNextNextGaussian = false;
  }

  /** Never more than 27 bits here, so the result is a non-negative int as in Java. */
  next(bits) {
    this.seed = (this.seed * MULTIPLIER + ADDEND) & MASK;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextDouble() {
    return (this.next(26) * 2 ** 27 + this.next(27)) * 2 ** -53;
  }

  nextGaussian() {
    if (this.haveNextNextGaussian) {
      this.haveNextNextGaussian = false;
      return this.nextNextGaussian;
    }
    let v1, v2, s;
    do {
      v1 = 2 * this.nextDouble() - 1;
      v2 = 2 * this.nextDouble() - 1;
      s = v1 * v1 + v2 * v2;
    } while (s >= 1 || s === 0);
    const multiplier = Math.sqrt((-2 * Math.log(s)) / s);
    this.nextNextGaussian = v2 * multiplier;
    this.haveNextNextGaussian = true;
    return v1 * multiplier;
  }
}

/** The six series, each `SIZE` long, in the order {@link SERIES} names them. */
export function generateDataset() {
  const prices = new Float64Array(SIZE);
  const priceRng = new JavaRandom(SEED);
  prices[0] = START_PRICE;
  for (let i = 1; i < SIZE; i++) {
    prices[i] = prices[i - 1] * (1.0 + priceRng.nextGaussian() * VOLATILITY);
  }

  const opens = new Float64Array(SIZE);
  const highs = new Float64Array(SIZE);
  const lows = new Float64Array(SIZE);
  const closes = new Float64Array(SIZE);
  const barRng = new JavaRandom(SEED + 1n);
  let close = START_PRICE;
  for (let i = 0; i < SIZE; i++) {
    const range = close * VOLATILITY * (1 + barRng.nextDouble());
    opens[i] = close + (barRng.nextDouble() - 0.5) * range * 0.3;
    highs[i] = close + range;
    lows[i] = close - range;
    closes[i] = lows[i] + (highs[i] - lows[i]) * barRng.nextDouble();
    close = closes[i];
  }

  const volumes = new Float64Array(SIZE);
  const volumeRng = new JavaRandom(SEED + 2n);
  for (let i = 0; i < SIZE; i++) {
    volumes[i] = 1_000_000 * (0.5 + volumeRng.nextDouble());
  }
  return { prices, opens, highs, lows, closes, volumes };
}

/** Writes the six series one after the other as little-endian doubles. */
export function writeDataset(file) {
  const dataset = generateDataset();
  const out = new Float64Array(SERIES.length * SIZE);
  SERIES.forEach((name, index) => out.set(dataset[name], index * SIZE));
  // Float64Array is in the platform's byte order; every platform these runtimes ship on is little-endian
  writeFileSync(file, new Uint8Array(out.buffer));
}

/** Reads a file written by {@link writeDataset}. */
export function readDataset(bytes) {
  const all = new Float64Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return Object.fromEntries(SERIES.map((name, index) => [name, all.subarray(index * SIZE, (index + 1) * SIZE)]));
}
