import { describe, it, expect } from "vitest";
import { ParamAxis } from "../../../src/execution/sweep/ParamAxis";
import { Sampler } from "../../../src/execution/sweep/Sampler";
import { createSweepSpec } from "../../../src/execution/sweep/SweepSpec";
import type { SweepSpec } from "../../../src/execution/sweep/SweepSpec";
import {
  expandSweep,
  latticeSize,
  MAX_SAFE_COMBOS,
  type ParamVector,
} from "../../../src/execution/sweep/SweepExpander";
import { SweepAdmissionException } from "../../../src/execution/sweep/SweepAdmissionException";

/** Structural dedupe: two maps are "the same run" iff their key/value pairs match. */
function distinctCount(runs: readonly ParamVector[]): number {
  return new Set(runs.map((r) => JSON.stringify(r))).size;
}

// Mirrors the canonical engine's SweepExpanderTest (18 behaviors). GRID is
// pure arithmetic (exact-value cartesian product) so its numbers match the
// canonical engine's directly. RANDOM/LHS mirror the *contract* (sample
// counts, without-replacement, Latin stratification, determinism given a
// seed) with a different PRNG — see SeededRng.ts — so their concrete vectors
// are TS-local, not cross-engine fixtures.
describe("expandSweep", () => {
  // ---- grid ---------------------------------------------------------------

  describe("grid", () => {
    it("is the full cartesian product", () => {
      const spec = createSweepSpec({
        sampler: Sampler.GRID,
        axes: [
          ParamAxis.range("a", 1, 3, 1), // 3 points
          ParamAxis.range("b", 10, 20, 5), // 3 points (10,15,20)
        ],
      });

      const runs = expandSweep(spec, 1000);
      expect(runs).toHaveLength(9);

      // Every map carries both axes, in declaration order.
      expect(Object.keys(runs[0])).toEqual(["a", "b"]);

      // The product covers all distinct combos exactly once.
      expect(distinctCount(runs)).toBe(9);
    });

    it("is deterministic order (last axis varies fastest)", () => {
      const spec = createSweepSpec({
        sampler: Sampler.GRID,
        axes: [ParamAxis.range("a", 0, 2, 1), ParamAxis.range("b", 0, 2, 1)],
      });
      const first = expandSweep(spec, 1000);
      const second = expandSweep(spec, 1000);
      expect(first).toEqual(second);
      expect(first[0]).toEqual({ a: 0, b: 0 });
      expect(first[1]).toEqual({ a: 0, b: 1 });
      expect(first[3]).toEqual({ a: 1, b: 0 });
    });

    it("mixes explicit values and range axes", () => {
      const spec = createSweepSpec({
        sampler: Sampler.GRID,
        axes: [ParamAxis.values("ema.fast", [5, 9, 12]), ParamAxis.range("rsi.period", 1, 2, 1)],
      });
      const runs = expandSweep(spec, 100);
      expect(runs).toHaveLength(6);
      for (const run of runs) {
        expect([5, 9, 12]).toContain(run["ema.fast"]);
      }
    });
  });

  // ---- arithmetic admission -------------------------------------------------

  describe("admission", () => {
    it("rejects a huge combo count without materializing", () => {
      // 10 axes of 10 points each = 10^10 combos; must be rejected by
      // multiplication, never allocated (no OOM).
      const axes = Array.from({ length: 10 }, (_, i) => ParamAxis.range(`p${i}`, 0, 9, 1));
      const spec = createSweepSpec({ sampler: Sampler.GRID, axes });

      let caught: unknown;
      try {
        expandSweep(spec, 1_000_000);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SweepAdmissionException);
      const sae = caught as SweepAdmissionException;
      // 10^10 doesn't overflow a safe integer, so combos is exact and huge.
      expect(sae.combos).toBe(10_000_000_000);
      expect(sae.maxCombos).toBe(1_000_000);
      expect(sae.overflowed).toBe(false);
    });

    it("overflow saturates and rejects", () => {
      // 40 axes of 10 points = 10^40, far past Number.MAX_SAFE_INTEGER -> saturating sentinel.
      const axes = Array.from({ length: 40 }, (_, i) => ParamAxis.range(`p${i}`, 0, 9, 1));
      const spec = createSweepSpec({ sampler: Sampler.GRID, axes });

      let caught: unknown;
      try {
        expandSweep(spec, 1_000_000);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SweepAdmissionException);
      const sae = caught as SweepAdmissionException;
      expect(sae.overflowed).toBe(true);
      expect(sae.combos).toBe(MAX_SAFE_COMBOS);
    });

    it("accepts a grid at exactly maxCombos", () => {
      const spec = createSweepSpec({
        sampler: Sampler.GRID,
        axes: [ParamAxis.range("a", 1, 5, 1)], // 5 combos
      });
      expect(expandSweep(spec, 5)).toHaveLength(5);
      expect(() => expandSweep(spec, 4)).toThrow(SweepAdmissionException);
    });

    it("rejects random samples above maxCombos", () => {
      const spec = createSweepSpec({
        sampler: Sampler.RANDOM,
        seed: 1,
        samples: 50,
        axes: [ParamAxis.range("a", 0, 100, 1)],
      });
      let caught: unknown;
      try {
        expandSweep(spec, 25);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SweepAdmissionException);
      expect((caught as SweepAdmissionException).combos).toBe(50);
    });

    it("latticeSize is overflow-safe", () => {
      const axes = Array.from({ length: 40 }, (_, i) => ParamAxis.range(`p${i}`, 0, 9, 1));
      expect(latticeSize(axes)).toBe(MAX_SAFE_COMBOS);
    });
  });

  // ---- random: reproducibility + no-replacement -----------------------------

  describe("random", () => {
    it("same seed produces an identical list", () => {
      const spec = createSweepSpec({
        sampler: Sampler.RANDOM,
        seed: 42,
        samples: 20,
        axes: [ParamAxis.range("a", 0, 50, 1), ParamAxis.range("b", 0, 50, 1)],
      });
      const first = expandSweep(spec, 1000);
      const second = expandSweep(spec, 1000);
      expect(first).toEqual(second);
    });

    it("different seed produces a different list", () => {
      const specFor = (seed: number): SweepSpec =>
        createSweepSpec({
          sampler: Sampler.RANDOM,
          seed,
          samples: 20,
          axes: [ParamAxis.range("x", 0, 100, 1)],
        });
      expect(expandSweep(specFor(1), 1000)).not.toEqual(expandSweep(specFor(2), 1000));
    });

    it("samples without replacement: all distinct", () => {
      const spec = createSweepSpec({
        sampler: Sampler.RANDOM,
        seed: 7,
        samples: 40,
        axes: [ParamAxis.range("a", 0, 9, 1), ParamAxis.range("b", 0, 9, 1)], // 10 x 10 = 100
      });
      const runs = expandSweep(spec, 1000);
      expect(runs).toHaveLength(40);
      expect(distinctCount(runs)).toBe(40); // no duplicate param vectors
    });

    it("samples are capped by the lattice when asked for more", () => {
      // Lattice has only 9 points but 50 samples requested; without
      // replacement we can return at most 9 distinct points.
      const spec = createSweepSpec({
        sampler: Sampler.RANDOM,
        seed: 3,
        samples: 50,
        axes: [ParamAxis.range("a", 0, 2, 1), ParamAxis.range("b", 0, 2, 1)], // 3 x 3 = 9
      });
      const runs = expandSweep(spec, 1000);
      expect(runs).toHaveLength(9);
      expect(distinctCount(runs)).toBe(9);
    });
  });

  // ---- lhs: reproducibility + marginal coverage ------------------------------

  describe("lhs", () => {
    it("same seed produces an identical list", () => {
      const spec = createSweepSpec({
        sampler: Sampler.LHS,
        seed: 99,
        samples: 10,
        axes: [ParamAxis.range("a", 0, 9, 1), ParamAxis.range("b", 0, 9, 1)],
      });
      expect(expandSweep(spec, 1000)).toEqual(expandSweep(spec, 1000));
    });

    it("hits each stratum exactly once per dimension", () => {
      // n == axis size: every lattice value is its own stratum, so each
      // dimension's n samples must cover all n distinct values exactly once
      // (Latin property).
      const n = 10;
      const spec = createSweepSpec({
        sampler: Sampler.LHS,
        seed: 123,
        samples: n,
        axes: [ParamAxis.range("a", 0, 9, 1), ParamAxis.range("b", 0, 9, 1)], // 10 values each
      });
      const runs = expandSweep(spec, 1000);
      expect(runs).toHaveLength(n);

      for (const dim of ["a", "b"]) {
        const marginal = runs.map((m) => m[dim]);
        expect(new Set(marginal).size).toBe(n);
      }
    });

    it("decorrelates dimensions: not all samples on the diagonal", () => {
      // With independent per-dim shuffles, samples should not all sit on the
      // a==b diagonal (that would be the un-shuffled failure mode).
      const n = 10;
      const spec = createSweepSpec({
        sampler: Sampler.LHS,
        seed: 2026,
        samples: n,
        axes: [ParamAxis.range("a", 0, 9, 1), ParamAxis.range("b", 0, 9, 1)],
      });
      const runs = expandSweep(spec, 1000);
      const onDiagonal = runs.filter((m) => m.a === m.b).length;
      expect(onDiagonal).toBeLessThan(n); // not perfectly correlated
    });

    it("has marginal coverage when there are fewer samples than lattice points", () => {
      // n < axis size: strata partition the index range; each stratum used
      // once, so the n marginal values are distinct (spread across the axis).
      const n = 5;
      const spec = createSweepSpec({
        sampler: Sampler.LHS,
        seed: 55,
        samples: n,
        axes: [ParamAxis.range("a", 0, 19, 1)], // 20 values, 5 strata of 4
      });
      const runs = expandSweep(spec, 1000);
      const marginal = runs.map((m) => m.a);
      expect(new Set(marginal).size).toBe(n);
    });
  });

  // ---- spec validation --------------------------------------------------------

  describe("spec validation", () => {
    it("random sampler requires samples > 0", () => {
      expect(() =>
        createSweepSpec({ sampler: Sampler.RANDOM, axes: [ParamAxis.range("a", 0, 1, 1)] }),
      ).toThrow();
    });

    it("duplicate axis name is rejected", () => {
      expect(() =>
        createSweepSpec({
          axes: [ParamAxis.range("a", 0, 1, 1), ParamAxis.range("a", 0, 1, 1)],
        }),
      ).toThrow();
    });
  });
});
