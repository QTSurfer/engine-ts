import type { PropertyHints } from "./PropertyHints";

/**
 * A value a sweep axis can take: numbers, strings/enum names, or booleans —
 * the same "mixed but ordinary" shape the canonical engine allows.
 */
export type AxisValue = number | string | boolean;

/** Number of decimal digits `n`'s canonical string form is written with, e.g. `2.5` → 1, `3` → 0. */
function decimalDigits(n: number): number {
  const s = Math.abs(n).toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Builds the float-safe lattice `[from, from+step, …, ≤to]` without
 * accumulating `double` drift.
 *
 * The canonical engine does this with `BigDecimal.valueOf(double)`, which
 * reads a double through its shortest round-tripping decimal string (so
 * `0.1` is treated as the literal "0.1", not its binary approximation) and
 * then divides at fixed scale. TypeScript has no arbitrary-precision decimal
 * in the standard library, so this ports the same idea without a bignum
 * dependency: `from`/`to`/`step` are read through their own canonical
 * `toString()` (same shortest-round-trip guarantee `Number` gives), scaled up
 * to the smallest common integer lattice, and every point is generated with
 * integer arithmetic before scaling back down. Point count and point values
 * are exact for realistic sweep magnitudes (percentages, periods, small
 * decimals); pathological inputs needing exponential notation (`>= 1e21` or
 * `< 1e-6`) fall outside this method's guarantees, same as the canonical
 * engine's own fixed `BigDecimal` scale has its own practical ceiling.
 */
function buildLattice(from: number, to: number, step: number): number[] {
  const scale = Math.max(decimalDigits(from), decimalDigits(to), decimalDigits(step));
  const factor = 10 ** scale;
  const fromScaled = Math.round(from * factor);
  const toScaled = Math.round(to * factor);
  const stepScaled = Math.round(step * factor);

  const span = toScaled - fromScaled;
  const steps = Math.floor(span / stepScaled);
  const pointCount = steps + 1;

  const values = new Array<number>(pointCount);
  for (let i = 0; i < pointCount; i++) {
    values[i] = (fromScaled + i * stepScaled) / factor;
  }
  return values;
}

/**
 * One sweepable dimension. An axis is a finite, ordered lattice of candidate
 * values for a single parameter. Two flavors:
 *
 * - **numeric** `{from, to, step}` — discretized onto the step lattice:
 *   `from, from+step, …` up to (and including, within tolerance) `to`.
 * - **explicit** `{values: […]}` — a caller-supplied ordered list of values
 *   (numbers, strings/enum names, booleans), used verbatim.
 *
 * The axis never materializes a parameter map; it only knows its own values,
 * so {@link ParamAxis.size} can feed arithmetic admission before any
 * cross-product is built.
 *
 * Port of the canonical engine's `ParamAxis`.
 */
export class ParamAxis {
  private constructor(
    private readonly _name: string,
    private readonly _values: readonly AxisValue[],
  ) {}

  /**
   * Builds a numeric axis discretized onto the step lattice.
   *
   * @param name parameter name
   * @param from inclusive lattice start
   * @param to inclusive lattice end (snapped to the nearest reachable step)
   * @param step lattice resolution; must be `> 0`
   * @returns the axis with `floor((to - from) / step) + 1` points
   */
  static range(name: string, from: number, to: number, step: number): ParamAxis {
    if (!Number.isFinite(from)) {
      throw new Error(`from must be finite: ${from}`);
    }
    if (!Number.isFinite(to)) {
      throw new Error(`to must be finite: ${to}`);
    }
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`step must be > 0: ${step}`);
    }
    if (to < from) {
      throw new Error(`to (${to}) must be >= from (${from})`);
    }
    return new ParamAxis(name, buildLattice(from, to, step));
  }

  /**
   * Builds an explicit-values axis. Values are used verbatim and may be
   * numbers, strings/enum names or booleans. Duplicate values are rejected
   * so the lattice stays a proper set (keeps without-replacement sampling
   * well-defined).
   */
  static values(name: string, values: readonly AxisValue[]): ParamAxis {
    if (values.length === 0) {
      throw new Error(`values must be non-empty for axis ${name}`);
    }
    const copy: AxisValue[] = [];
    for (const v of values) {
      if (v === null || v === undefined) {
        throw new Error("axis values must not contain null");
      }
      if (copy.includes(v)) {
        throw new Error(`duplicate value ${String(v)} on axis ${name}`);
      }
      copy.push(v);
    }
    return new ParamAxis(name, copy);
  }

  /**
   * Builds a numeric axis from {@link PropertyHints}. Requires all three of
   * `min`/`max`/`step` to be present — partial hints (e.g. a `max`-only
   * clamp) describe a UI pre-fill, not a full lattice, so they cannot resolve
   * to a sweep axis on their own.
   */
  static fromHints(name: string, hints: PropertyHints): ParamAxis {
    if (hints.min === undefined || hints.max === undefined || hints.step === undefined) {
      throw new Error(
        `ParamAxis.fromHints requires min, max and step to all be present for axis "${name}"`,
      );
    }
    return ParamAxis.range(name, hints.min, hints.max, hints.step);
  }

  name(): string {
    return this._name;
  }

  /** Number of lattice points; feeds arithmetic admission without materializing. */
  size(): number {
    return this._values.length;
  }

  /** The lattice value at `index` (0-based, in lattice order). */
  valueAt(index: number): AxisValue {
    return this._values[index];
  }

  /** The ordered, immutable lattice values. */
  values(): readonly AxisValue[] {
    return this._values;
  }
}
