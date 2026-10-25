import type { Asset } from "./Asset";

/**
 * Asset-code helpers behind the strategy currency filter.
 * Port of the wildcard part of com.wualabs.qtsurfer.engine.core.util.CurrencyHelper
 *
 * Sets hold upper-case asset codes rather than `Asset` objects: two `Asset` instances are
 * equal by code but are not the same reference, so a `Set<Asset>` could never find one.
 */

/** Wildcard character: `¿USD` matches any code ending in `USD`, `USD¿` any code starting with it. */
export const PATTERN_ANY = "¿";

function hasPattern(code: string): boolean {
  return code.includes(PATTERN_ANY);
}

/** The plain codes of `currencyCodes`, upper-cased; wildcard entries are left to `toPatternSet`. */
export function toSet(currencyCodes: readonly string[]): ReadonlySet<string> {
  return new Set(currencyCodes.filter((code) => !hasPattern(code)).map((code) => code.toUpperCase()));
}

/** The wildcard entries of `currencyCodes`, upper-cased. */
export function toPatternSet(currencyCodes: readonly string[]): ReadonlySet<string> {
  return new Set(currencyCodes.filter(hasPattern).map((code) => code.toUpperCase()));
}

export function startsWith(asset: Asset, prefixCode: string): boolean {
  return asset.code.startsWith(prefixCode);
}

export function endsWith(asset: Asset, suffixCode: string): boolean {
  return asset.code.endsWith(suffixCode);
}

/**
 * Matches an asset code against wildcard patterns. A leading `¿` matches any prefix (`¿USD`
 * matches BUSD, TUSD); a trailing `¿` matches any suffix (`USD¿` matches USDT, USDC).
 */
export function matchPattern(asset: Asset, patterns: ReadonlySet<string> | undefined): boolean {
  if (patterns === undefined) {
    return false;
  }
  for (const pattern of patterns) {
    if (pattern.startsWith(PATTERN_ANY) && endsWith(asset, pattern.slice(1))) {
      return true;
    } else if (pattern.endsWith(PATTERN_ANY) && startsWith(asset, pattern.slice(0, -1))) {
      return true;
    }
  }
  return false;
}
