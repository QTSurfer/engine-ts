# @qtsurfer/indicators-trading-signals

Comparison tests and benchmarks for QTSurfer RT indicators vs [trading-signals](https://github.com/bennycode/trading-signals) (v7.4.3) — the most popular actively maintained TypeScript technical analysis library with streaming incremental API.

## Key Classes

- **TradingSignalsAdapter** — adapts any trading-signals `TechnicalIndicator` to the `RTIndicator` interface, with custom value extraction for compound results (MACD, Bollinger Bands) and full reset support via factory function
- **BenchmarkPriceData** — generates 10,000 reproducible synthetic prices via seeded PRNG random walk (seed=42, volatility=0.5%)

## Performance: RT Indicators vs trading-signals

Vitest bench throughput benchmarks comparing native RT indicators against trading-signals equivalents.

| Indicator | RT (ops) | RT O(1) (ops) | trading-signals (ops) | Ratio |
|-----------|:--------:|:-------------:|:---------------------:|:-----:|
| EMA(20) | 28,085 | — | 24,681 | **RT 1.14x** |
| SMA(20) | 17,224 | — | 5,682 | **RT 3.03x** |
| WMA(20) | 202 | 2,165 | 4,964 | **TS 2.29x** (vs O(1)) |
| WMA(200) | 23 | 2,183 | 675 | **RT O(1) 3.23x** |
| RSI(14) | 1,277 | — | 1,461 | **TS 1.14x** |
| MACD(12,26) | 3,951 | — | 3,675 | **RT 1.08x** |
| Bollinger(20,2) | 1,141 | — | 722 | **RT 1.58x** |
| StochRSI(14) | 398 | — | 396 | **RT 1.01x** |

> Vitest bench — 10,000 prices per invocation. Apple M4 Pro, Node.js. Each run creates a fresh indicator and feeds all prices.

**Key findings:**
- **SMA**: RT's O(1) ring buffer is 3.03x faster than trading-signals' array-based implementation
- **EMA**: Both libraries use O(1) incremental formula — RT has slight edge from avoiding Big.js overhead
- **Bollinger Bands**: RT's incremental variance is 1.58x faster
- **WMA**: Both trading-signals and the base `WmaRTIndicator` are O(n). The O(1) `WmaIncrementalRTIndicator` loses at period=20 (framework overhead > scanning 20 numbers) but wins at period=200 by 3.23x as algorithmic complexity dominates
- **MACD**: RT is now ~1.08x faster — decorator chain overhead has been reduced
- **RSI**: trading-signals has slight edge (1.14x)
- **StochRSI**: Effectively tied (1.01x)

## Comparison Tests

7 test suites validating behavioral equivalence between RT and trading-signals implementations:

| Indicator | Tests | What's Validated |
|-----------|:-----:|------------------|
| EMA(20) | 4 | Convergence (<0.02), value range, correlation (>0.99), reset |
| SMA(20) | 4 | Convergence (<0.001), value range, correlation (>0.99), reset |
| WMA(20) | 4 | Convergence (<0.001), value range, correlation (>0.99), reset |
| RSI(14) | 4 | Convergence (<1.0), 0–100 range, correlation (>0.4), reset |
| MACD(12,26) | 4 | Convergence (<0.05), oscillation, sign agreement (>0.8), reset |
| Bollinger(20,2) | 4 | Middle/upper/lower band convergence, band containment (>85%), reset |
| StochRSI(14) | 4 | Valid range (RT: 0–100, TS: 0–1), non-trivial output, range check, reset |

### Running Tests

```bash
pnpm --filter @qtsurfer/indicators-trading-signals test
```

### Running Benchmarks

```bash
pnpm --filter @qtsurfer/indicators-trading-signals bench
```

## Dependencies

- `@qtsurfer/indicators` — provides the `RTIndicator` interface and all RT indicator implementations
- `trading-signals` — the trading-signals library whose indicators are being compared
