import type { ParamAxis } from "./ParamAxis";
import { Sampler } from "./Sampler";

/**
 * Immutable description of a parameter sweep: an ordered set of
 * {@link ParamAxis} (the dimensions), the {@link Sampler} to expand them
 * with, and the sampler-specific `seed` / `samples`.
 *
 * Axis order is preserved (array/insertion order) so expansion is
 * deterministic and the cartesian product of a `GRID` sweep is stable across
 * calls.
 *
 * Port of the canonical engine's `SweepSpec`, built via {@link createSweepSpec}
 * instead of a fluent builder — a plain options object is the idiomatic
 * TypeScript shape for an immutable value with a couple of cross-field
 * invariants.
 */
export interface SweepSpec {
  readonly axes: readonly ParamAxis[];
  readonly sampler: Sampler;
  readonly seed: number;
  /** Number of samples requested (random/lhs only; `0` for grid). */
  readonly samples: number;
}

export interface SweepSpecOptions {
  /** At least one axis, with unique names. */
  readonly axes: readonly ParamAxis[];
  /** Defaults to {@link Sampler.GRID}. */
  readonly sampler?: Sampler;
  /** Defaults to `0`. Ignored by `GRID`. */
  readonly seed?: number;
  /** Required (`> 0`) for `RANDOM`/`LHS`; ignored by `GRID`. */
  readonly samples?: number;
}

/**
 * Builds a {@link SweepSpec}, enforcing unique axis names and
 * sampler-specific invariants — the same checks the canonical engine's
 * `SweepSpec.Builder` performs at `build()` time.
 */
export function createSweepSpec(options: SweepSpecOptions): SweepSpec {
  const axes = options.axes;
  if (axes.length === 0) {
    throw new Error("sweep must declare at least one axis");
  }
  const names = new Set<string>();
  for (const axis of axes) {
    if (names.has(axis.name())) {
      throw new Error(`duplicate axis name: ${axis.name()}`);
    }
    names.add(axis.name());
  }

  const sampler = options.sampler ?? Sampler.GRID;
  const samples = options.samples ?? 0;
  if ((sampler === Sampler.RANDOM || sampler === Sampler.LHS) && samples <= 0) {
    throw new Error(`${sampler} sampler requires samples > 0`);
  }

  return {
    axes: [...axes],
    sampler,
    seed: options.seed ?? 0,
    samples,
  };
}
