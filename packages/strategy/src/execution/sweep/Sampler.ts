/**
 * Sampling strategy for expanding a `SweepSpec` into parameter maps.
 *
 * - `GRID` — full cartesian product of every axis lattice (exhaustive).
 *   Ignores `samples`/`seed`.
 * - `RANDOM` — `samples` seeded uniform draws over the lattice, without
 *   replacement when the lattice is small enough to enumerate.
 * - `LHS` — Latin Hypercube: stratified per dimension (one sample per
 *   stratum per dim), seeded shuffle to decorrelate dims.
 *
 * Port of the canonical engine's `Sampler` enum.
 */
export enum Sampler {
  GRID = "GRID",
  RANDOM = "RANDOM",
  LHS = "LHS",
}
