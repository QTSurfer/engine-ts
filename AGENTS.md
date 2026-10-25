# AGENTS.md

This document defines how AI agents should understand, modify, and operate within this repository.

## Project Overview

QTSurfer Engine TS is the TypeScript port of the QTSurfer quantitative trading engine. It provides real-time streaming technical indicators and a strategy framework with a backtest pipeline for browser-based backtesting — all as a pnpm monorepo.

**Relationship to Java engine:** The Java engine is the production runtime of the QTSurfer platform; this TS port enables browser-based and Node.js backtesting.

## Build Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build a specific package
pnpm --filter @qtsurfer/core build
pnpm --filter @qtsurfer/indicators build

# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @qtsurfer/indicators test

# Type-check without emitting
pnpm --filter @qtsurfer/indicators lint

# Clean all dist
pnpm clean

# Run benchmarks
pnpm --filter @qtsurfer/indicators bench
pnpm --filter @qtsurfer/indicators-trading-signals bench
```

### Standalone Benchmarks — @qtsurfer/indicators

Absolute throughput baseline for all ported indicators. 10,000 prices per invocation, Apple M4 Pro, Node.js 22;
median of three runs on 2026-10-23. The suite runs every benchmark in one process, so a row also moves with what
ran before it (MACD read 1,238, 1,845 and 1,238 on the three runs); `bench:cross-runtime` below measures one
indicator per process. The two volatility rows were measured after they took the Java engine's algorithm, over an
`SmaRTIndicator(20)`.

| Indicator | ops | Category |
|-----------|----:|----------|
| EMA(20) | 31,454 | averages |
| SMA(20) discrete | 14,830 | averages |
| SMA(20) moving | 14,877 | averages |
| MMA(20) | 12,640 | averages |
| TEMA(20) | 3,148 | averages |
| KAMA(10,2,30) | 1,885 | averages |
| WMA(20) | 1,735 | averages |
| WmaIncremental(20) | 7,535 | averages |
| HMA(20) | 985 | averages |
| RateChange | 3,207 | helpers |
| Volatility(20) | 7,619 | helpers |
| PercentVolatility(20) | 4,829 | helpers |
| Gain | 2,382 | helpers |
| Loss | 2,452 | helpers |
| PercentChangePeriod | 1,998 | helpers |
| DistanceFromSMA(20) | 3,909 | indicators |
| DistanceFromEMA(20) | 1,746 | indicators |
| MACD(12,26) | 1,238 | indicators |
| Bollinger(20,2) | 871 | indicators |
| RSI(14) | 635 | indicators |
| StdDev(20) | 926 | statistics |
| StochRSI(14) | 241 | indicators |
| ATR(14) | 11,950 | indicators |
| CCI(20) | 1,872 | indicators |
| Transform.abs(EMA(20)) | 4,114 | numeric |
| Conditional.positive(EMA(20)) | 3,047 | numeric |
| BiFunction.plus(EMA,SMA) | 2,667 | numeric |

### Cross-runtime Benchmark — Java against TypeScript

Each indicator in the Java engine (JMH) against this package in Node.js, Deno and Bun, on the same machine and the
same 10,000 values, one indicator per process, with the value each side ends on. The Java side runs when
`QTS_JAVA_ENGINE` names a checkout of the Java engine. Method, options and results:
`packages/indicators/bench/cross-runtime/README.md`.

```bash
pnpm --filter @qtsurfer/indicators bench:cross-runtime
QTS_JAVA_ENGINE=/path/to/java-engine pnpm --filter @qtsurfer/indicators bench:cross-runtime
```

## Package Structure

Every indicator of the Java engine, with its TS class (or none yet) and the builders that register it:
[`indicators.md`](indicators.md).

```
packages/
├── core/                          # @qtsurfer/core
├── indicators/                    # @qtsurfer/indicators
├── indicators-trading-signals/    # @qtsurfer/indicators-trading-signals
└── strategy/                      # @qtsurfer/strategy
```

- **@qtsurfer/core** — Shared types and data structures ported from `qtsurfer-engine-core`:
  - `Resettable` interface
  - `WindowSeries`, `WritableWindowSeries` interfaces
  - `WindowSeriesStore` — ring buffer (`Float64Array`) for windowed time series
  - `Instrument` (spot, perpetual and dated variants, `Instrument.parse` / `Instrument.of`), `Asset`, `CurrencyHelper` (the `¿` wildcard matching behind the strategy currency filter)
  - `StateStore` — simple KV state store for indicator state management, handed to a listener
    already resolved (the `StateStoreSupport` indirection is gone)
  - `operators/Predicates` — numeric predicate factories (`positive`, `lessThan`, `greaterOrEqual`, etc.)
  - `operators/Unaries` — numeric unary operator factories (`plus`, `multiply`, `clamp`, etc.)

- **@qtsurfer/indicators** — Real-time streaming indicator implementations ported from `qtsurfer-engine-indicators`:
  - `core/` — Base classes: `RTIndicator` interface, `IndicatorMeta` and `DisplayHint` (what an indicator says about itself), `AbstractRTIndicator`, `AbstractIncrementalRTIndicator`, `AbstractDecorableRTIndicator`, `AbstractDecorableIncrementalRTIndicator`, `AbstractEmaRTIndicator`, `AbstractWindowSeriesRTIndicator`
  - `averages/` — `EmaRTIndicator`, `MmaRTIndicator`, `SmaRTIndicator` (discrete + moving modes), `WmaRTIndicator`, `WmaIncrementalRTIndicator` (O(1) incremental), `HmaRTIndicator`, `TemaRTIndicator`, `KamaRTIndicator`
  - `numeric/` — `ValueRTIndicator`, `ConstantRTIndicator`, `ReadOnlyRTIndicator`, `SumRTIndicator`, `RoundRTIndicator`, `TransformRTIndicator`, `ClampRTIndicator`, `ClampPredicateRTIndicator`, `PredicateRTIndicator`, `ConditionalRTIndicator`, `BiFunctionRTIndicator`
  - `statistics/` — `MovingAverage` (O(1) rolling), `VarianceRTIndicator`, `StandardDeviationRTIndicator`
  - `helpers/` — `PeriodCounterRTIndicator`, `GainRTIndicator`, `LossRTIndicator`, `MaxRTIndicator`, `MinRTIndicator`, `CountRTIndicator`, `RateChangeRTIndicator`, `PredicatePeriodCounterRTIndicator`, `PercentChangePeriodRTIndicator`, `VolatilityRTIndicator`, `PercentVolatilityRTIndicator`, `OnChangeRTIndicator`, `WindowTimeRTIndicator`
  - `indicators/` — `RsiRTIndicator`, `MacdRTIndicator`, `CciRTIndicator`, `StochasticRsiRTIndicator`, `DistanceRTIndicator`, `DistanceFromMaRTIndicator`, `AtrRTIndicator`
  - `bollinger/` — `BollingerBandsRTIndicator`, `BollingerBandWidthRTIndicator`, `BollingerPercentBRTIndicator`

- **@qtsurfer/indicators-trading-signals** — Comparison tests and benchmarks: RT indicators vs [trading-signals](https://github.com/bennycode/trading-signals) library:
  - 7 comparison test suites (EMA, SMA, WMA, RSI, MACD, Bollinger Bands, StochRSI) — 28 tests total
  - `TradingSignalsAdapter` — generic adapter wrapping any trading-signals indicator into `RTIndicator`
  - `BenchmarkPriceData` — 10k seeded random walk for reproducible benchmarks
  - vitest bench suite comparing throughput: RT native vs trading-signals
  - Run: `pnpm --filter @qtsurfer/indicators-trading-signals test` / `bench`

- **@qtsurfer/strategy** — Strategy framework: signal hierarchy, the strategy classes (`AbstractStrategy`, `AbstractTickerStrategy`, `AbstractKlineStrategy`), the backtest execution pipeline with its simulation layer, yield metrics. Also holds the cross-engine conformance suite (`tests/conformance/`)

## Architecture

### Core Interface

The fundamental interface is `RTIndicator`:
```ts
interface RTIndicator extends Resettable {
  getValue(): number;
  update(newValue: number): number;
  isReady(): boolean;
  reset(): void;
  // Optional descriptor members, implemented by AbstractRTIndicator
  getMeta?(): IndicatorMeta;
  getId?(): string;
  isHidden?(): boolean;
  getDisplayHint?(): DisplayHint;
}
```

### Names and metadata
- A registered name carries no display suffix: `rsi(14)` registers `rsi14`, `percentChange("price")` registers `chgprice`. A name that still has a `%` does not resolve.
- What a name used to encode rides the indicator's `IndicatorMeta` (`id`, `periods`, `k`, `band`, `src`, `dsp`, `vis`). `DisplayHint` is the typed view of `dsp`: `ABSOLUTE` (no entry), `PERCENT` (`P`), `VOLUME` (`V`).
- Metadata is a write-only descriptor: an indicator never reads it to compute. `ReadOnlyRTIndicator` reads and writes the metadata of the indicator it wraps.
- A `_`-prefixed name is internal. `InstrumentMapRTIndicator.add` turns it into hidden metadata, and `forEachPublicable` (so the info signal) skips hidden indicators, which are still updated.

### Indicator Hierarchy
- `AbstractRTIndicator` — Base implementation storing a single value
- `AbstractIncrementalRTIndicator` — Periodic/non-periodic incremental computation
- `AbstractDecorableIncrementalRTIndicator` — Chains indicators (e.g., `new SmaRTIndicator(new GainRTIndicator())`)
- `AbstractEmaRTIndicator` — EMA formula base with configurable alpha
- `AbstractWindowSeriesRTIndicator` — Uses `WindowSeriesStore` ring buffer

### Key Design Patterns
1. **Decorator pattern**: Indicators wrap other indicators as input sources
2. **Incremental computation**: Window-based indicators use `tickValue()` callbacks
3. **Period management**: `periodCycles`, `isPeriodic`, `isReady()` for warmup tracking
4. **1:1 Java parity**: Each TS class mirrors its Java counterpart — same algorithm, same test values

## Conventions

### File Naming
- **PascalCase** for all source files: `RTIndicator.ts`, `AbstractEmaRTIndicator.ts`, `MovingAverage.ts`
- Matches the Java class name convention for easy cross-referencing

### Import Aliases
Each package uses `$`-prefixed aliases to avoid relative path traversal:
```ts
import { AbstractEmaRTIndicator } from "$core/AbstractEmaRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { MovingAverage } from "$statistics/MovingAverage";
```

Aliases are defined in `tsconfig.json` (`paths`), `tsup.config.ts` (`esbuildOptions.alias`), and `vitest.config.ts` (`resolve.alias`).

Available aliases in `@qtsurfer/indicators`: `$core`, `$averages`, `$bollinger`, `$numeric`, `$statistics`, `$helpers`, `$indicators`.

### Same-directory imports
Within the same directory, use `./` relative imports:
```ts
import { AbstractRTIndicator } from "./AbstractRTIndicator";
```

### Package imports
Cross-package imports use the npm package name:
```ts
import { WindowSeriesStore } from "@qtsurfer/core";
```

## Tech Stack

- **TypeScript 5.x** with strict mode
- **pnpm** workspaces for monorepo management
- **tsup** for bundling (ESM output + `.d.ts` generation)
- **Vitest** for testing
- **Zero runtime dependencies** — pure computation library

## Testing

Tests use Vitest. Test files live in `tests/` mirroring the `src/` package structure.

```bash
# Run all indicator tests
pnpm --filter @qtsurfer/indicators test

# Run with watch mode
pnpm --filter @qtsurfer/indicators vitest
```

### Test counts per package

| Package | Tests | Notes |
|---|---|---|
| @qtsurfer/core | 35 | `WindowSeriesStore`, `StateStore`, operators |
| @qtsurfer/indicators | 257 | Phases 1-4: averages (EMA, SMA, MMA, WMA, WmaIncremental, HMA, TEMA, KAMA), helpers (Gain, Loss, Max, Min, Count, RateChange, PeriodCounter, PredicatePeriodCounter, PercentChangePeriod, Volatility, PercentVolatility, OnChange, WindowTime), numeric (Value, Constant, ReadOnly, Sum, Round, Transform, Clamp, ClampPredicate, Predicate, Conditional, BiFunction), statistics (Variance, StdDev), indicators (RSI, MACD, CCI, StochRSI, Distance, DistanceFromMa, ATR), bollinger (Bands, BandWidth) — matching Java reference values |
| @qtsurfer/strategy | 510 | Strategy hierarchy, backtest pipeline and simulation layer, yield metrics, conformance suite |
| @qtsurfer/indicators-trading-signals | 28 | Convergence, value range, correlation, and reset tests for EMA, SMA, WMA, RSI, MACD, Bollinger Bands, StochRSI vs trading-signals library |

### Cross-validation with Java
Test expected values are taken directly from the Java test suite (`Fixtures.CLOSE_PRICES_LIST` = Wilder's 33-element dataset). Any new indicator port must match the Java test assertions exactly.

## Porting a Java indicator

When porting a Java indicator to TypeScript:
1. Read the Java source completely (class + test)
2. Port the class maintaining identical algorithm and naming
3. Port the test with identical assertions and reference data
4. Verify: `pnpm --filter @qtsurfer/indicators build && pnpm --filter @qtsurfer/indicators test`
5. Update this AGENTS.md package structure section, and the indicator's row in `indicators.md` (its TS class, and
   the builder method if one registers it)

### Core Principles
- **Simplicity First**: Make every change as simple as possible
- **Java Parity**: The TS port must produce identical numeric results to the Java engine
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards
- **Minimal Impact**: Changes should only touch what's necessary
