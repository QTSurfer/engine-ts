// Measures one benchmark in this process, the way JMH measures it on the Java side: the indicator is
// built outside the timed region, one op feeds it the whole dataset, 3 warm-up iterations and 5
// measured ones of one second each. One benchmark per process, as JMH forks one JVM per benchmark,
// so no benchmark inherits what another one left in the JIT.
//
// Usage: <node | bun | deno run --allow-read> harness.mjs <benchmark> <bundle.mjs> <dataset.bin>
// Prints one JSON line: throughput in ops/s per iteration, and the value one op ends on.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BENCHMARKS, feeder } from "./benchmarks.mjs";
import { readDataset } from "./data.mjs";

const WARMUP_ITERATIONS = 3;
const MEASURED_ITERATIONS = 5;
const ITERATION_MS = 1000;
/** Indicators built ahead of each timed stretch, so building one never falls inside it. */
const BUILT_AHEAD = 32;

const [name, bundle, datasetFile] = typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2);
const benchmark = BENCHMARKS[name];
if (!benchmark) throw new Error(`unknown benchmark '${name}': ${Object.keys(BENCHMARKS).join(", ")}`);
const indicators = await import(pathToFileURL(bundle).href);
const op = feeder(benchmark.input, readDataset(readFileSync(datasetFile)));
const make = () => benchmark.make(indicators);

// Every result lands here so no op can be optimised away
let sink = 0;

function iteration() {
  let ops = 0;
  let timed = 0;
  const end = performance.now() + ITERATION_MS;
  while (performance.now() < end) {
    const ahead = [];
    for (let i = 0; i < BUILT_AHEAD; i++) ahead.push(make());
    for (const indicator of ahead) {
      const start = performance.now();
      sink += op(indicator);
      timed += performance.now() - start;
      ops++;
    }
  }
  return ops / (timed / 1000);
}

for (let i = 0; i < WARMUP_ITERATIONS; i++) iteration();
const iterations = [];
for (let i = 0; i < MEASURED_ITERATIONS; i++) iterations.push(iteration());

const runtime = typeof Bun !== "undefined" ? "bun" : typeof Deno !== "undefined" ? "deno" : "node";
const version = runtime === "bun" ? Bun.version : runtime === "deno" ? Deno.version.deno : process.versions.node;
console.log(
  JSON.stringify({
    name,
    runtime,
    version,
    opsPerSecond: iterations.reduce((sum, value) => sum + value, 0) / iterations.length,
    iterations,
    value: op(make()),
    sinkIsFinite: Number.isFinite(sink),
  }),
);
