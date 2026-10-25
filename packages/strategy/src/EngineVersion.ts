import { version as packageVersion } from "../package.json";

/** Reported when the version cannot be determined. */
const UNKNOWN = "unknown";

/**
 * Reported by the numeric accessors when the version is not a parseable `major.minor.patch`,
 * including when it is `UNKNOWN`. Negative on purpose: a gate such as `getMinor() >= 99` then
 * fails closed rather than matching by accident.
 */
const UNKNOWN_COMPONENT = -1;

/** Leading `major.minor.patch`; any build qualifier (`-beta.1`, ...) is ignored. */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)/;

const MAX_INT = 2_147_483_647;

export interface EngineVersionComponents {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

const UNRESOLVED: EngineVersionComponents = {
  major: UNKNOWN_COMPONENT,
  minor: UNKNOWN_COMPONENT,
  patch: UNKNOWN_COMPONENT,
};

/**
 * All three components or none: a version this does not recognise yields `UNKNOWN_COMPONENT`
 * across the board rather than a half-parsed mix, so a caller that checks one component can
 * trust the others. A component too large for a 32-bit integer is not recognised either.
 */
export function parseComponents(version: string): EngineVersionComponents {
  const match = SEMVER.exec(version);
  if (match === null) return UNRESOLVED;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  if (major > MAX_INT || minor > MAX_INT || patch > MAX_INT) return UNRESOLVED;
  return { major, minor, patch };
}

function resolve(): string {
  return typeof packageVersion === "string" && packageVersion.trim() !== ""
    ? packageVersion.trim()
    : UNKNOWN;
}

const VERSION = resolve();
const COMPONENTS = parseComponents(VERSION);

/**
 * The version of the engine this package ships in, read from its own `package.json` when it is
 * built, so it cannot drift from the published artifact.
 * Port of com.wualabs.qtsurfer.engine.EngineVersion
 */
export const EngineVersion = {
  UNKNOWN,
  UNKNOWN_COMPONENT,

  /** The engine version (e.g. `"0.11.0"`), or `UNKNOWN`. */
  get(): string {
    return VERSION;
  },

  /** The major component of `get()` (the `0` of `"0.11.0"`), or `UNKNOWN_COMPONENT`. */
  getMajor(): number {
    return COMPONENTS.major;
  },

  /** The minor component of `get()` (the `11` of `"0.11.0"`), or `UNKNOWN_COMPONENT`. */
  getMinor(): number {
    return COMPONENTS.minor;
  },

  /** The patch component of `get()` (the `0` of `"0.11.0"`), or `UNKNOWN_COMPONENT`. */
  getPatch(): number {
    return COMPONENTS.patch;
  },
};
