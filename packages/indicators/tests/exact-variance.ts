/**
 * The population variance of values with at most `decimals` decimals, worked out exactly in integers
 * (n·Σx² − (Σx)² over n²) and rounded once at the end: what the indicators are compared against.
 */
export function exactPopulationVariance(values: readonly number[], decimals = 2): number {
  const scale = 10 ** decimals;
  const n = BigInt(values.length);
  let sum = 0n;
  let squares = 0n;
  for (const v of values) {
    const scaled = BigInt(Math.round(v * scale));
    sum += scaled;
    squares += scaled * scaled;
  }
  return Number(n * squares - sum * sum) / (scale * scale) / Number(n * n);
}

/**
 * A quiet market: `count` prices around `base`, each a few cents from the one before (a fixed
 * generator, so the series is the same on every run). With a base in the tens of thousands, a window's
 * variance is tiny next to its mean squared, which is where a running sum of squares loses it.
 */
export function quietPrices(count: number, base = 68705.81): number[] {
  let state = 12345;
  const out: number[] = [];
  let cents = Math.round(base * 100);
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    cents += (state >>> 16) % 5 - 2; // -2 .. +2 cents
    out.push(cents / 100);
  }
  return out;
}
