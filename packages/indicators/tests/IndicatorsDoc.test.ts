// indicators.md names every indicator class the package exports, and only builder methods that exist.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { InstrumentGroupRTIndicator } from "../src/index";

const root = path.resolve(__dirname, "..", "..", "..");
const md = readFileSync(path.join(root, "indicators.md"), "utf8");
const src = path.resolve(__dirname, "..", "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return statSync(file).isDirectory() ? sources(file) : file.endsWith(".ts") ? [file] : [];
  });
}

const text = sources(src).map((file) => readFileSync(file, "utf8"));
const concrete = text.flatMap((t) => [...t.matchAll(/^export class ([A-Za-z]+RTIndicator)\b/gm)].map((m) => m[1]!));
const everything = new Set(text.flatMap((t) => [...t.matchAll(/^export (?:abstract )?class ([A-Za-z]+RTIndicator)\b/gm)].map((m) => m[1]!)));
const mentioned = new Set([...md.matchAll(/`([A-Za-z]+RTIndicator)`/g)].map((m) => m[1]!));

describe("indicators.md", () => {
  it("names every concrete indicator class of the package", () => {
    expect(concrete.filter((name) => !mentioned.has(name)).sort()).toEqual([]);
  });

  it("names only classes the package has", () => {
    expect([...mentioned].filter((name) => !everything.has(name)).sort()).toEqual([]);
  });

  it("names only builder methods that InstrumentGroupRTIndicator has", () => {
    const methods = new Set(Object.getOwnPropertyNames(InstrumentGroupRTIndicator.prototype));
    // a cell that holds only method names: `sma`, `percentChange`
    const named = md
      .split("\n")
      .filter((line) => line.startsWith("| "))
      .flatMap((line) => line.split("|").slice(1, -1))
      .filter((cell) => /^( *`[a-z][A-Za-z]*`,?)+ *$/.test(cell))
      .flatMap((cell) => [...cell.matchAll(/`([a-z][A-Za-z]*)`/g)].map((m) => m[1]!));
    expect(new Set(named).size).toBeGreaterThan(20);
    expect(named.filter((name) => !methods.has(name)).sort()).toEqual([]);
  });
});
