# Cross-runtime benchmark — Java against TypeScript

How much faster or slower each indicator is in the Java engine than in this package, on the same
machine and the same data, and whether both end on the same value. TypeScript runs in Node.js and Deno
(V8, the engine of Chrome) and in Bun (JavaScriptCore, the engine of Safari and of the macOS webview).

```bash
# TypeScript only, every runtime found on the PATH
pnpm --filter @qtsurfer/indicators bench:cross-runtime

# With the Java side: a checkout of the Java engine (a relative path is read from where you type it)
QTS_JAVA_ENGINE=/path/to/java-engine pnpm --filter @qtsurfer/indicators bench:cross-runtime

# A subset
pnpm --filter @qtsurfer/indicators bench:cross-runtime --only rtCci,rtHma --runtimes node,bun
```

The table is printed and written to `out/results.md`; `out/results.json` keeps every iteration. A full
run takes about ten minutes (14 indicators × 3 runtimes, 8 seconds each, plus the Java side).

## What each side does

- **The data** is the dataset of the Java engine's JMH benchmarks (`BenchmarkPriceData`): 10,000 prices
  and 10,000 bars from fixed seeds. `data.mjs` regenerates it from the same seeds through a port of
  `java.util.Random`, byte for byte, so the TypeScript side needs no Java to get it. It is written once,
  by Node.js: JavaScriptCore's `Math.log` differs from Java's `StrictMath.log` in the last bit now and
  then (Bun regenerates 9,623 of its 480,000 bytes differently), V8's does not.
- **TypeScript**: `run.mjs` bundles this package and `@qtsurfer/core` straight from `src` (the working
  tree, not a build), then `harness.mjs` measures one indicator per process, the way JMH forks one JVM
  per benchmark: the indicator is built outside the timed region, one op feeds it the whole dataset,
  3 warm-up iterations and 5 measured ones of one second each.
- **Java**, when `QTS_JAVA_ENGINE` (or `--java <dir>`) names a checkout: compiles its indicator modules
  and their benchmarks (`mvn -pl qtsurfer-engine-indicators-pro -am test-compile` — it writes that
  checkout's `target/` and builds it as it stands, uncommitted changes included), runs the JMH benchmark
  of each row with the same protocol (`-wi 3 -w 1s -i 5 -r 1s -f 1`), and `JavaValues.java` for the
  value each indicator ends on.

Each row of `benchmarks.mjs` names the JMH benchmark that builds the same indicator with the same
arguments. ATR and the O(1) WMA come from the Java engine's pro module; here they are
`AtrRTIndicator` and `WmaIncrementalRTIndicator`. A new row needs that JMH benchmark and its line in
`JavaValues.java`.

## Reading it

- **Java ÷ runtime** is how many times faster Java is; below 1, the runtime is faster.
- **Values** says `identical` when every column ends on the same double, and otherwise how far apart
  (relative) each one is from the first.
- **One run is not a measurement.** On a laptop with performance and efficiency cores and other work
  running, one row moves by a quarter or more between runs (EMA(14) in Node.js went from 17,600 to
  29,300 ops/s across eight runs of the same code; Java's RSI(14) from 2,600 to 4,600 across two runs).
  Repeat, and compare medians.
- It compares runtimes **on one machine**: it says nothing about a server's processor against a
  user's, nor about anything around the indicators (data loading, the strategy, the chart).

## Results, 2026-10-23

Apple M4 Pro, one run; Java 25.0.2 (HotSpot C2), Node.js 22.23.1, Bun 1.4.2, Deno 2.2.5. Ops per
second, one op = 10,000 values.

| Indicator | Java | Node.js | Bun | Deno | Java ÷ Node.js | Java ÷ Bun | Java ÷ Deno | Values |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| EMA(14) | 15,368 | 21,413 | 12,735 | 22,169 | 0.72× | 1.21× | 0.69× | identical |
| SMA(20) | 32,985 | 21,201 | 16,621 | 20,933 | 1.56× | 1.98× | 1.58× | identical |
| TEMA(20) | 13,296 | 3,960 | 5,909 | 4,252 | 3.36× | 2.25× | 3.13× | identical |
| MACD(12,26) | 13,949 | 4,205 | 6,081 | 4,375 | 3.32× | 2.29× | 3.19× | identical |
| KAMA(10,2,30) | 3,300 | 1,894 | 1,817 | 1,985 | 1.74× | 1.82× | 1.66× | identical |
| RSI(14) | 2,608 | 1,392 | 2,160 | 749 | 1.87× | 1.21× | 3.48× | identical |
| StochRSI(14) | 690 | 335 | 816 | 298 | 2.06× | 0.85× | 2.31× | identical |
| CCI(20) | 3,290 | 2,354 | 3,155 | 2,454 | 1.40× | 1.04× | 1.34× | identical |
| HMA(20) | 1,750 | 1,042 | 1,688 | 990 | 1.68× | 1.04× | 1.77× | identical |
| Bollinger(20,2) | 2,978 | 1,433 | 1,672 | 1,451 | 2.08× | 1.78× | 2.05× | identical |
| WMA(20) O(1) | 10,163 | 11,865 | 9,098 | 11,526 | 0.86× | 1.12× | 0.88× | identical |
| WMA(20) | 3,441 | 1,921 | 3,352 | 1,854 | 1.79× | 1.03× | 1.86× | identical |
| ATR(14) | 10,913 | 11,555 | 12,837 | 10,990 | 0.94× | 0.85× | 0.99× | identical |
| Variance(20) | 3,924 | 1,722 | 2,263 | 1,959 | 2.28× | 1.73× | 2.00× | identical |
| **Median** | | | | | 1.77× | 1.21× | 1.81× | |

Every indicator ends on the same double in all four runtimes. Java is a median 1.8 times faster than
V8 and 1.2 times faster than JavaScriptCore here; no row is an order of magnitude apart.

Before the window of `AbstractWindowSeriesRTIndicator` became one shared class, the same harness gave
CCI(20) 152 ops/s in Node.js and 66 in Bun, WMA(20) 151 and 494, HMA(20) 82 and 315: Java was 21 to 25
times faster than Node.js on those rows, and 51 times faster than Bun on CCI.
