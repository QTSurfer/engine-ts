/**
 * Small seeded PRNG (mulberry32) for the `RANDOM`/`LHS` samplers.
 *
 * The canonical engine seeds `java.util.Random` from `SweepSpec.seed()`.
 * TypeScript has no equivalent in the standard library, so this reuses the
 * mulberry32 pattern already established in
 * `packages/indicators-trading-signals/src/BenchmarkPriceData.ts` (kept
 * local — deliberately not imported across packages). It gives the same
 * *contract* as the canonical engine: deterministic given a seed, so the
 * same `(spec, seed)` always reproduces the same TS sample list. It is a
 * different generator, so random/LHS draws are **not** numerically identical
 * to the canonical engine's output for the same seed — only the statistical
 * properties (sample counts, without-replacement, Latin stratification,
 * determinism) are mirrored, by design.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer draw in `[0, bound)`. */
export function nextIndex(rand: () => number, bound: number): number {
  return Math.floor(rand() * bound);
}

/** In-place Fisher-Yates shuffle driven by the shared seeded generator. */
export function shuffle(values: number[], rand: () => number): void {
  for (let i = values.length - 1; i > 0; i--) {
    const j = nextIndex(rand, i + 1);
    const tmp = values[i];
    values[i] = values[j];
    values[j] = tmp;
  }
}
