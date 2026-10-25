import type { AxisValue, ParamAxis } from "./ParamAxis";
import { mulberry32, nextIndex, shuffle } from "./SeededRng";
import { Sampler } from "./Sampler";
import { SweepAdmissionException } from "./SweepAdmissionException";
import type { SweepSpec } from "./SweepSpec";

/** One parameter map — one backtest run's worth of `{axisName: value}`. */
export type ParamVector = Record<string, AxisValue>;

/**
 * Saturating sentinel for an overflowed lattice-size product. JavaScript has
 * no native 64-bit integer, so this plays the role the canonical engine's
 * `Long.MAX_VALUE` sentinel plays for its `long` arithmetic: the largest
 * integer `number` can represent exactly. Not numerically equal to the
 * canonical sentinel — the "overflowed" *signal* is what's mirrored, not the
 * bit pattern.
 */
export const MAX_SAFE_COMBOS = Number.MAX_SAFE_INTEGER;

/**
 * Overflow-safe lattice size `∏ axisᵢ.size()`. Returns {@link MAX_SAFE_COMBOS}
 * as a saturating sentinel the moment the product would exceed it, so callers
 * never multiply past the cap and never allocate the matrix.
 */
export function latticeSize(axes: readonly ParamAxis[]): number {
  let product = 1;
  for (const axis of axes) {
    const size = axis.size();
    if (size !== 0 && product > MAX_SAFE_COMBOS / size) {
      return MAX_SAFE_COMBOS;
    }
    product *= size;
  }
  return product;
}

function admit(combos: number, maxCombos: number): void {
  const overflowed = combos === MAX_SAFE_COMBOS;
  if (combos > maxCombos) {
    throw new SweepAdmissionException(
      `Sweep grid expands to ${
        overflowed ? `>= ${MAX_SAFE_COMBOS} (overflow)` : combos
      } combos, exceeding maxCombos=${maxCombos}`,
      combos,
      maxCombos,
      overflowed,
    );
  }
}

/**
 * Admission for random/lhs: the run count is `samples`, capped both by
 * `maxCombos` and (for without-replacement) by the lattice size.
 *
 * @returns the effective number of runs to produce
 */
function admitSampled(samples: number, lattice: number, maxCombos: number): number {
  if (samples <= 0) {
    throw new Error(`samples must be > 0: ${samples}`);
  }
  if (samples > maxCombos) {
    throw new SweepAdmissionException(
      `Sweep requests ${samples} samples, exceeding maxCombos=${maxCombos}`,
      samples,
      maxCombos,
      false,
    );
  }
  // Without replacement we cannot draw more distinct points than the lattice holds.
  if (lattice !== MAX_SAFE_COMBOS && samples > lattice) {
    return lattice;
  }
  return samples;
}

/**
 * Decodes a linear lattice index into a name-keyed parameter map (mixed-radix,
 * last axis varies fastest), preserving axis-declaration order.
 */
function decode(axes: readonly ParamAxis[], index: number): ParamVector {
  const dims = axes.length;
  const valueIndices = new Array<number>(dims);
  let remaining = index;
  for (let d = dims - 1; d >= 0; d--) {
    const size = axes[d].size();
    valueIndices[d] = remaining % size;
    remaining = Math.floor(remaining / size);
  }
  const map: ParamVector = {};
  for (let d = 0; d < dims; d++) {
    map[axes[d].name()] = axes[d].valueAt(valueIndices[d]);
  }
  return map;
}

function expandGrid(axes: readonly ParamAxis[], lattice: number): ParamVector[] {
  const result = new Array<ParamVector>(lattice);
  for (let index = 0; index < lattice; index++) {
    result[index] = decode(axes, index);
  }
  return result;
}

/**
 * Seeded uniform sampling over the linearized lattice, without replacement:
 * distinct linear indices are drawn into a set until `n` are collected, then
 * sorted for a stable order. Deterministic for a given seed.
 */
function sampleRandom(
  axes: readonly ParamAxis[],
  lattice: number,
  n: number,
  rand: () => number,
): ParamVector[] {
  const picked = new Set<number>();
  while (picked.size < n) {
    picked.add(nextIndex(rand, lattice));
  }
  return [...picked].sort((a, b) => a - b).map((index) => decode(axes, index));
}

/**
 * Maps a stratum (0..n-1) to a concrete lattice index in `[0, size)`. Each
 * stratum spans an equal slice of the axis index range; the value is the
 * slice's representative (deterministic given seed — picks within the slice
 * when the slice holds more than one lattice point).
 */
function stratumToValueIndex(stratum: number, n: number, size: number, rand: () => number): number {
  if (n >= size) {
    // More (or equal) strata than lattice points: map stratum directly,
    // wrapping so every value is covered and strata cycle the lattice.
    return stratum % size;
  }
  // Fewer strata than points: stratum spans [lo, hi); pick a point inside it.
  const lo = Math.floor((stratum * size) / n);
  const hi = Math.floor(((stratum + 1) * size) / n);
  const span = hi - lo;
  const offset = span <= 1 ? 0 : nextIndex(rand, span);
  return lo + offset;
}

/**
 * Latin Hypercube sampling over the lattice. For each of the `n` samples and
 * each dimension, a stratum is picked so that, per dimension, the `n` strata
 * are spread evenly across that axis's lattice and each stratum is hit
 * exactly once (when `n` divides cleanly into the axis size, every value is
 * a stratum; otherwise strata are an even partition of the index range). A
 * per-dimension seeded shuffle of the stratum assignment decorrelates the
 * dimensions so samples don't line up on the lattice diagonal.
 */
function sampleLhs(axes: readonly ParamAxis[], n: number, rand: () => number): ParamVector[] {
  const dims = axes.length;
  // perm[d] = the stratum index (0..n-1) assigned to sample i on dimension d.
  const perm: number[][] = [];
  for (let d = 0; d < dims; d++) {
    const order = Array.from({ length: n }, (_, i) => i);
    shuffle(order, rand);
    perm.push(order);
  }
  const result: ParamVector[] = [];
  for (let i = 0; i < n; i++) {
    const map: ParamVector = {};
    for (let d = 0; d < dims; d++) {
      const axis = axes[d];
      const stratum = perm[d][i];
      const valueIndex = stratumToValueIndex(stratum, n, axis.size(), rand);
      map[axis.name()] = axis.valueAt(valueIndex);
    }
    result.push(map);
  }
  return result;
}

/**
 * Pure, engine-side utility that expands a {@link SweepSpec} into a
 * deterministic, ordered list of parameter maps — one map per backtest run.
 *
 * Contract highlights:
 *
 * - **Arithmetic admission FIRST.** Before materializing anything, the
 *   lattice size product `N = ∏ axisᵢ.size()` is computed with overflow
 *   protection and rejected with a {@link SweepAdmissionException} (carrying
 *   `N`) if it exceeds `maxCombos`. An enormous grid dies as a
 *   multiplication, never an allocation.
 * - **Determinism.** Same `(spec, seed)` always yields an identical list
 *   (same order, same maps). Random/LHS use a seeded generator; grid is
 *   index order.
 * - **Without replacement.** Random and LHS sample distinct lattice points
 *   whenever `samples <= ` the lattice size.
 * - **Ordered, name-keyed maps.** Each map is a plain object keyed in
 *   axis-declaration order, so callers / persistence see a stable shape.
 *
 * @param spec the sweep specification
 * @param maxCombos hard cap on the number of runs; admission rejects above it
 * @returns ordered, deterministic list of parameter maps (size `<= maxCombos`)
 * @throws SweepAdmissionException if the grid lattice size exceeds `maxCombos`
 *   (grid), or if the requested `samples` exceeds `maxCombos` (random/lhs)
 *
 * Port of the canonical engine's `SweepExpander.expand`.
 */
export function expandSweep(spec: SweepSpec, maxCombos: number): ParamVector[] {
  if (maxCombos <= 0) {
    throw new Error(`maxCombos must be > 0: ${maxCombos}`);
  }

  const axes = spec.axes;
  const lattice = latticeSize(axes);

  switch (spec.sampler) {
    case Sampler.GRID: {
      admit(lattice, maxCombos);
      return expandGrid(axes, lattice);
    }
    case Sampler.RANDOM: {
      const n = admitSampled(spec.samples, lattice, maxCombos);
      return sampleRandom(axes, lattice, n, mulberry32(spec.seed));
    }
    case Sampler.LHS: {
      const n = admitSampled(spec.samples, lattice, maxCombos);
      return sampleLhs(axes, n, mulberry32(spec.seed));
    }
    default: {
      // Exhaustiveness guard: fails to compile if Sampler ever grows a member
      // this switch doesn't handle.
      const unreachable: never = spec.sampler;
      throw new Error(`Unknown sampler: ${String(unreachable)}`);
    }
  }
}
