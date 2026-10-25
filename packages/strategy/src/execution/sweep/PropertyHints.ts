/**
 * Optional numeric range hints for a strategy property: a suggested minimum,
 * maximum and step for the property's value. Purely advisory metadata for
 * callers that build sweepable {@link ParamAxis} lattices (parameter sweeps,
 * UI range pre-fills) — it never constrains or validates the property's
 * runtime value.
 *
 * Standalone by design: this type does not couple to any property-definition
 * registry or IR schema, it is just the shape a caller hands to
 * {@link ParamAxis.fromHints}. Loosely mirrors the canonical engine's
 * `PropertyHints`, adapted to TypeScript's optional-field idiom in place of
 * the `NaN`-sentinel doubles a Java record needs for "absent".
 */
export interface PropertyHints {
  /** Suggested minimum, or `undefined` if unset. */
  readonly min?: number;
  /** Suggested maximum, or `undefined` if unset. */
  readonly max?: number;
  /** Suggested step/resolution, or `undefined` if unset. */
  readonly step?: number;
}

/** Shared instance representing the absence of any hint. */
export const NO_PROPERTY_HINTS: PropertyHints = Object.freeze({});

/** True when every one of `min`/`max`/`step` is absent. */
export function isEmptyHints(hints: PropertyHints): boolean {
  return hints.min === undefined && hints.max === undefined && hints.step === undefined;
}
