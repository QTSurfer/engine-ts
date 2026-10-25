#!/usr/bin/env node
// Java against TypeScript, one indicator at a time, on one machine. README.md next to this file says
// what it measures and how to read it.
//
//   node bench/cross-runtime/run.mjs [--only rtEma,rtCci] [--runtimes node,bun,deno] [--java <dir>]
//
// The Java side runs only when a checkout of the Java engine is given, with --java or
// QTS_JAVA_ENGINE. Everything it writes lands in out/, next to this file.

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "tsup";
import { BENCHMARKS } from "./benchmarks.mjs";
import { SIZE, writeDataset } from "./data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "../..");
const out = join(here, "out");

const RUNTIMES = {
  node: { command: process.execPath, args: [] },
  bun: { command: "bun", args: [] },
  deno: { command: "deno", args: ["run", "--allow-read"] },
};
const ALIASED_DIRS = ["core", "averages", "bollinger", "numeric", "statistics", "helpers", "indicators", "group"];

const { values: options } = parseArgs({
  options: { only: { type: "string" }, runtimes: { type: "string" }, java: { type: "string" } },
});
const names = options.only ? options.only.split(",") : Object.keys(BENCHMARKS);
for (const name of names) {
  if (!BENCHMARKS[name]) throw new Error(`unknown benchmark '${name}': ${Object.keys(BENCHMARKS).join(", ")}`);
}
const runtimes = (options.runtimes ? options.runtimes.split(",") : Object.keys(RUNTIMES)).filter((runtime) => {
  if (!RUNTIMES[runtime]) throw new Error(`unknown runtime '${runtime}': ${Object.keys(RUNTIMES).join(", ")}`);
  const found = spawnSync(RUNTIMES[runtime].command, ["--version"], { stdio: "ignore" }).status === 0;
  if (!found) console.error(`${runtime}: not on the PATH, skipped`);
  return found;
});
const javaEngine = options.java ?? process.env.QTS_JAVA_ENGINE;

mkdirSync(out, { recursive: true });

// This package and @qtsurfer/core straight from src: the run measures the working tree, not a build
const src = join(pkg, "src");
await build({
  entry: { indicators: join(src, "index.ts") },
  outDir: out,
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  target: "es2022",
  platform: "node",
  noExternal: [/.*/],
  dts: false,
  sourcemap: false,
  silent: true,
  config: false,
  esbuildOptions(esbuild) {
    // As in tsup.config.ts: getId() derives an indicator's type from its class name
    esbuild.keepNames = true;
    esbuild.alias = {
      ...Object.fromEntries(ALIASED_DIRS.map((dir) => [`$${dir}`, join(src, dir)])),
      "@qtsurfer/core": resolve(pkg, "../core/src/index.ts"),
    };
  },
});
const bundle = join(out, "indicators.mjs");
const dataset = join(out, "data.bin");
writeDataset(dataset);

// A relative path is read from where the command was typed: pnpm and npm run the script in the
// package's directory and leave the original one in INIT_CWD
const java = javaEngine ? runJava(resolve(process.env.INIT_CWD ?? process.cwd(), javaEngine)) : null;

const ts = {};
for (const runtime of runtimes) {
  ts[runtime] = {};
  for (const name of names) {
    console.error(`${runtime}: ${BENCHMARKS[name].label}`);
    const { command, args } = RUNTIMES[runtime];
    ts[runtime][name] = JSON.parse(capture(command, [...args, join(here, "harness.mjs"), name, bundle, dataset], here));
  }
}

const report = render();
writeFileSync(join(out, "results.md"), report);
writeFileSync(join(out, "results.json"), JSON.stringify({ date: new Date().toISOString(), cpu: cpus()[0]?.model, java, ts }, null, 2));
console.log(report);

/** Builds the engine's indicator modules, runs their JMH benchmarks and the value of each indicator. */
function runJava(engine) {
  const proModule = join(engine, "qtsurfer-engine-indicators-pro");
  if (!existsSync(proModule)) throw new Error(`${engine} has no qtsurfer-engine-indicators-pro: not a Java engine checkout`);
  const classpathFile = join(out, "java-classpath.txt");
  console.error(`java: compiling ${engine} (the indicator modules and their benchmarks)`);
  run(
    "mvn",
    [
      "-q",
      "-pl",
      "qtsurfer-engine-indicators-pro",
      "-am",
      "test-compile",
      "dependency:build-classpath",
      `-Dmdep.outputFile=${classpathFile}`,
      "-Dmdep.includeScope=test",
      "-DskipTests",
      "-Djacoco.skip=true",
      "-Dspotless.check.skip=true",
    ],
    engine,
    join(out, "java-build.log"),
  );
  // -am writes every module's classpath to the same file; the benchmarks' module builds last
  const classpath = [
    join(proModule, "target/test-classes"),
    join(proModule, "target/classes"),
    readFileSync(classpathFile, "utf8").trim(),
  ].join(delimiter);

  console.error("java: JMH");
  const jmhResults = join(out, "java.json");
  const pattern = names.map((name) => `${BENCHMARKS[name].jmh.replace(".", "\\.")}$`).join("|");
  run(
    "java",
    ["-cp", classpath, "org.openjdk.jmh.Main", pattern, "-wi", "3", "-w", "1s", "-i", "5", "-r", "1s", "-f", "1"]
      .concat(["-rf", "json", "-rff", jmhResults]),
    here,
    join(out, "java.log"),
  );
  const jmh = JSON.parse(readFileSync(jmhResults, "utf8"));
  const values = JSON.parse(capture("java", ["-cp", classpath, join(here, "JavaValues.java"), dataset], here));

  const results = {};
  for (const name of names) {
    const entry = jmh.find((result) => result.benchmark.endsWith(`.${BENCHMARKS[name].jmh}`));
    if (!entry) continue;
    const perSecond = { "ops/s": 1, "ops/ms": 1e3, "ops/us": 1e6 }[entry.primaryMetric.scoreUnit];
    results[name] = {
      opsPerSecond: entry.primaryMetric.score * perSecond,
      error: entry.primaryMetric.scoreError * perSecond,
      value: Number(values[name]),
    };
  }
  return { version: jmh[0]?.jdkVersion, vm: jmh[0]?.vmName, results };
}

function run(command, args, cwd, logFile) {
  const log = openSync(logFile, "w");
  const result = spawnSync(command, args, { cwd, stdio: ["ignore", log, log] });
  closeSync(log);
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}: see ${logFile}`);
}

/** Runs a command and returns the last line it printed. */
function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${result.status}\n${result.stderr}`);
  return result.stdout.trim().split("\n").at(-1);
}

function render() {
  const columns = [...(java ? ["java"] : []), ...runtimes];
  const result = (column, name) => (column === "java" ? java.results[name] : ts[column][name]);
  const version = (column) =>
    column === "java" ? `Java ${java.version}` : `${column} ${ts[column][names[0]].version}`;
  const ratios = Object.fromEntries(runtimes.map((runtime) => [runtime, []]));

  const lines = [
    `Ops per second, one op = ${SIZE.toLocaleString("en-US")} values; ${cpus()[0]?.model ?? "unknown CPU"}, ${new Date().toISOString().slice(0, 10)}.`,
    ...(java ? ["Java ÷ runtime: how many times faster Java is (below 1, the runtime is faster)."] : []),
    "",
    `| Indicator | ${columns.map(version).join(" | ")} |${java ? ` ${runtimes.map((r) => `Java ÷ ${r}`).join(" | ")} |` : ""} Values |`,
    `|---|${columns.map(() => "---:").join("|")}|${java ? `${runtimes.map(() => "---:").join("|")}|` : ""}---|`,
  ];
  for (const name of names) {
    const cells = columns.map((column) => format(result(column, name)?.opsPerSecond));
    const javaCells = [];
    if (java) {
      for (const runtime of runtimes) {
        const ratio = java.results[name] ? java.results[name].opsPerSecond / ts[runtime][name].opsPerSecond : NaN;
        if (Number.isFinite(ratio)) ratios[runtime].push(ratio);
        javaCells.push(Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : "–");
      }
    }
    const row = [BENCHMARKS[name].label, ...cells, ...javaCells, compareValues(name, columns, result)];
    lines.push(`| ${row.join(" | ")} |`);
  }
  if (java) {
    const medians = runtimes.map((runtime) => `${median(ratios[runtime]).toFixed(2)}×`);
    lines.push(`| **Median** |${columns.map(() => "").join(" |")} | ${medians.join(" | ")} | |`);
  }
  return lines.join("\n") + "\n";
}

/** "identical" when every column ends on the same double, else how far each one is from the first. */
function compareValues(name, columns, result) {
  const [reference, ...others] = columns.filter((column) => result(column, name));
  if (others.length === 0) return "–";
  const expected = result(reference, name).value;
  const apart = others
    .map((column) => [column, result(column, name).value])
    .filter(([, value]) => !Object.is(value, expected))
    .map(([column, value]) => {
      const relative = Math.abs(value - expected) / Math.max(Math.abs(value), Math.abs(expected));
      return `${column} ${relative.toExponential(1)} apart`;
    });
  return apart.length === 0 ? "identical" : apart.join(", ");
}

function format(value) {
  return value === undefined ? "–" : value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
