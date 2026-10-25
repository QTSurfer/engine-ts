import { describe, it, expect } from "vitest";
import { version as packageVersion } from "../package.json";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { EngineVersion, parseComponents } from "../src/EngineVersion";
import * as publicApi from "../src/index";

class Versioned extends AbstractTickerStrategy {
  constructor() {
    super("Versioned");
  }

  version(): string {
    return this.getEngineVersion();
  }

  major(): number {
    return this.getEngineVersionMajor();
  }

  minor(): number {
    return this.getEngineVersionMinor();
  }
}

describe("EngineVersion", () => {
  it("is the version this package is published at", () => {
    expect(EngineVersion.get()).toBe(packageVersion);
    expect(EngineVersion.get()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("splits the version into its numeric components", () => {
    const [major, minor, patch] = packageVersion.split(/[.-]/).map(Number);
    expect(EngineVersion.getMajor()).toBe(major);
    expect(EngineVersion.getMinor()).toBe(minor);
    expect(EngineVersion.getPatch()).toBe(patch);
  });

  it("is exported from the package", () => {
    expect(publicApi.EngineVersion).toBe(EngineVersion);
  });

  it("names the values that mean not known", () => {
    expect(EngineVersion.UNKNOWN).toBe("unknown");
    expect(EngineVersion.UNKNOWN_COMPONENT).toBe(-1);
  });
});

describe("parseComponents", () => {
  it("reads major.minor.patch", () => {
    expect(parseComponents("0.99.55")).toEqual({ major: 0, minor: 99, patch: 55 });
    expect(parseComponents("12.0.3")).toEqual({ major: 12, minor: 0, patch: 3 });
  });

  it("ignores a build qualifier", () => {
    expect(parseComponents("1.2.3-beta.1")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseComponents("0.11.0-SNAPSHOT")).toEqual({ major: 0, minor: 11, patch: 0 });
  });

  it.each(["unknown", "", "1.2", "1", "v1.2.3", "a.b.c", "1.x.3", " 1.2.3"])(
    "gives -1 for all three components when the version is %j",
    (version) => {
      expect(parseComponents(version)).toEqual({ major: -1, minor: -1, patch: -1 });
    },
  );

  it("gives -1 for all three when one component is too large for a 32-bit integer", () => {
    expect(parseComponents("1.2.99999999999")).toEqual({ major: -1, minor: -1, patch: -1 });
    expect(parseComponents("2147483647.0.0")).toEqual({ major: 2147483647, minor: 0, patch: 0 });
  });
});

describe("AbstractStrategy engine version accessors", () => {
  it("report what EngineVersion reports", () => {
    const strategy = new Versioned();
    expect(strategy.version()).toBe(EngineVersion.get());
    expect(strategy.major()).toBe(EngineVersion.getMajor());
    expect(strategy.minor()).toBe(EngineVersion.getMinor());
  });

  it("let a strategy gate on the minor component", () => {
    expect(new Versioned().minor()).toBeGreaterThanOrEqual(0);
  });
});
