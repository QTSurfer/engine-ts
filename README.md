# QTSurfer Engine TS

<p align="center">
  <a href="https://github.com/QTSurfer/engine-ts/actions/workflows/ci.yaml"><img src="https://github.com/QTSurfer/engine-ts/actions/workflows/ci.yaml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@qtsurfer/indicators"><img src="https://img.shields.io/npm/v/@qtsurfer/indicators?label=%40qtsurfer%2Findicators" alt="npm"></a>
  <a href="LICENSING.md"><img src="https://img.shields.io/badge/License-AGPL%20v3%20%7C%20commercial-blue.svg" alt="License"></a>
</p>

TypeScript port of [QTSurfer](https://qtsurfer.com)'s quantitative trading engine. Provides real-time streaming technical indicators and a strategy framework for trading signals with a backtest pipeline — all as a pnpm monorepo, in the browser or in Node.js.

## Packages

| Package | Description |
|---|---|
| `@qtsurfer/core` | Shared types and data structures (`Ticker`, `Kline`, `TickerValueSource`, `KlineValueSource`, `MarketSnapshotValueSource`, `WindowSeriesStore`, `StateStore`) |
| `@qtsurfer/indicators` | Real-time streaming indicators (EMA, SMA, RSI, MACD, Bollinger, HMA, KAMA, TEMA, WMA, CCI, StochasticRSI, ATR) + time-windowed aggregation + instrument groups (ticker and kline sources) |
| `@qtsurfer/strategy` | Strategy framework — signal hierarchy, backtest execution pipeline, yield metrics |
| `@qtsurfer/indicators-trading-signals` | Comparison benchmarks vs [trading-signals](https://github.com/bennycode/trading-signals) |

## Installation

Requires Node.js 20 or later (or a current browser). The packages are ESM-only.

```bash
npm install @qtsurfer/indicators          # indicators (pulls in @qtsurfer/core)
npm install @qtsurfer/strategy            # strategies and backtests (pulls in both)
# or
pnpm add @qtsurfer/strategy
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Changes to a published package come with a changeset (`pnpm changeset`); [CONTRIBUTING.md](CONTRIBUTING.md) has the rest.

## Strategy Framework

The `@qtsurfer/strategy` package provides a 1-to-1 port of the Java strategy hierarchy:

```
AbstractStrategy
  └─ AbstractSubscriptionStrategy<T>
      ├─ AbstractTickerStrategy   (real-time tickers: bid/ask/last/vwap/…)
      └─ AbstractKlineStrategy    (OHLCV candlestick bars: open/high/low/close/volume)
```

### Market Data Types

**`Ticker`** — real-time order book snapshot. Fields: `last`, `bid`, `ask`, `bidSize`, `askSize`, `open`, `high`, `low`, `vwap`, `volume`, `quoteVolume`, `percentageChange`, `timestamp`, `instrument`.

**`Kline`** — OHLCV candlestick bar. Fields: `open`, `high`, `low`, `close`, `volume`, `quoteVolume`, `numberOfTrades`, `timestamp`, `instrument`.

Both are the engine's own types.

### Ticker Strategy

Strategies receive `Ticker` data, compute indicators via `InstrumentGroupRTIndicator`, and emit `BuySignal`/`SellSignal` events through a listener pattern. The backtest runner feeds historical tickers and produces trade yields with performance metrics.

```ts
import { AbstractTickerStrategy, BacktestRunner } from "@qtsurfer/strategy";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";

class EmaCrossover extends AbstractTickerStrategy {
  private readonly emaCross = new CrossDetector();

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator) {
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 3).ema("emaSlow", 7);
  }

  override update(ticker: Ticker) {
    const instrument = ticker.instrument;
    this.updateInstrument(instrument, ticker.timestamp);
    const ind = this.updateIndicators(instrument, ticker);

    const cross = this.emaCross.check(
      ind.getIndicatorValue("emaFast"), ind.getIndicatorValue("emaSlow"));
    if (cross.above) {
      this.emitBuy(instrument, ticker.last ?? 0);
    }
    if (cross.below) {
      this.emitSell(instrument, ticker.last ?? 0);
    }
  }
}

const result = BacktestRunner.run(new EmaCrossover(), tickers, {
  initialFunding: 10000, feeRate: 0.001, currency: "USDT",
});
console.log(result.metrics); // { sharpeRatio, sortinoRatio, cagr, maxDrawdownPercent, winRate, ... }
```

### Kline Strategy

For OHLCV bar-based strategies extend `AbstractKlineStrategy`. It uses `InstrumentMapKlineSourceRTIndicator` internally — indicators feed directly from kline fields with no Ticker bridge. Only OHLCV-based indicators are supported (no bid/ask/vwap/percentageChange).

```ts
import { AbstractKlineStrategy, BacktestRunner } from "@qtsurfer/strategy";
import type { Kline } from "@qtsurfer/core";
import { KlineValueSource } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";

class KlineEmaCrossover extends AbstractKlineStrategy {
  private readonly emaCross = new CrossDetector();

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator) {
    // addPrice() uses KlineValueSource.Close automatically on kline strategies
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 9).ema("emaSlow", 21);
    // Access other OHLCV fields explicitly:
    // indicators.add("high", KlineValueSource.High)
    // indicators.add("volume", KlineValueSource.Volume)
  }

  override update(kline: Kline) {
    const instrument = kline.instrument;
    this.updateInstrument(instrument, kline.timestamp);
    const ind = this.updateIndicators(instrument, kline);

    const cross = this.emaCross.check(
      ind.getIndicatorValue("emaFast"), ind.getIndicatorValue("emaSlow"));
    if (cross.above) {
      this.emitBuy(instrument, kline.close);
    }
    if (cross.below) {
      this.emitSell(instrument, kline.close);
    }
  }
}

// Closed bars go through the same execution pipeline as tickers. Pending orders
// resolve against each bar's close, before the strategy sees the bar.
const result = BacktestRunner.runKlines(new KlineEmaCrossover(), klines, {
  initialFunding: 10000, feeRate: 0.001, currency: "USDT",
});
```

### Backtest Simulation Layer (opt-in)

The default `BacktestConfig` reproduces the original immediate-fill, fee-on-sell semantics. Optional fields layer in finer simulation without touching strategy code:

- **Symmetric fees**: `feeRateBuy`, `feeRateSell` per-side overrides of `feeRate`, or a custom `feeModel` — built-ins include `FixedFeeModel` and `MakerTakerFeeModel` (maker rate for limit fills, taker rate for market / stop / trailing-stop fills, rebate-compatible).
- **Slippage**: flat `slippageBps`, or pluggable `slippageModel` — built-ins include `FixedBpsSlippage` and `BarRangeSlippage` (interpolates between signal price and adverse bar extreme).
- **Position sizing**: `buyPercent` controls fraction of cash spent per buy; `signal.sellPercent` controls fraction of position closed per sell with a residual that keeps the pipeline `EXECUTING` until fully unwound.
- **Fill timing**: `fillPolicy` — defaults to `ImmediateFill` (legacy). `NextBarOpenFill` defers every signal to the next bar's open and removes look-ahead bias of bar-close strategies.
- **Order kinds**: `signal.orderKind` is honored end-to-end. `limit` orders fill at the limit price with no slippage when a subsequent tick's `last` reaches it; `stop` orders trigger when `last` reaches the stop, become market, and apply slippage. `stopTrailing` orders keep a running peak (sell) or trough (buy), seeded with the signal price, and fire when `last` retraces `trailPercent` percent from it (or `trailDistance` price units when no percent is set). A filled buy carrying `stopPrice` auto-places a protective stop sell. Resolution always starts from the *next* tick after emission.

See [`packages/strategy/README.md`](./packages/strategy/README.md#pluggable-simulation-models) for the full table, custom-model interfaces, and end-to-end examples.

## Indicators

All indicators implement `RTIndicator`:

```ts
interface RTIndicator extends Resettable {
  getValue(): number;
  update(newValue: number): number;
  isReady(): boolean;
  reset(): void;
}
```

### Available Indicators

| Category | Indicators |
|---|---|
| Averages | EMA, SMA, MMA, WMA, HMA, KAMA, TEMA |
| Oscillators | RSI, Stochastic RSI, MACD, CCI |
| Bands | Bollinger Bands, Bollinger BandWidth, Bollinger %B |
| Volatility | StdDev, Variance, Volatility, % Volatility |
| Helpers | Gain, Loss, Max, Min, Sum, Distance, Distance from MA, Rate of Change, % Change |
| Time | WindowTimeRTIndicator (s1, s5, s10, s30, m1, m5, h1...), OnChangeRTIndicator |
| Groups | InstrumentGroupRTIndicator (fluent builder with `.window()` support, ticker and kline sources) |
| Numeric | Value, Constant, ReadOnly, Transform, BiFunction, Sum, Round, Conditional, Clamp, Predicate |

### Usage

```ts
import { EmaRTIndicator, InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { TickerValueSource } from "@qtsurfer/core";

// Standalone
const ema = new EmaRTIndicator(14);
ema.update(100); // → value

// Fluent builder with windows (ticker source)
const group = new InstrumentGroupRTIndicator("BTC/USDT");
group
  .add("price", TickerValueSource.AutoAskClose)
  .ema("emaFast", 9)
  .ema("emaSlow", 21)
  .rsi("rsi", 14, true)
  .window("rsi", "m1", (ss, prev, actual) => {
    console.log(`RSI changed: ${prev} → ${actual}`);
  });
```

## Tech Stack

- **TypeScript 5.x** — strict mode
- **pnpm** workspaces
- **tsup** — ESM bundling + `.d.ts` generation (core, indicators, strategy)
- **Vitest** — testing
- **Zero runtime dependencies**

## Relationship to Java Engine

QTSurfer's Java engine is the production runtime of the platform (well over a hundred indicators, JMH-benchmarked); this TypeScript port enables browser-based and Node.js backtesting.

All indicator implementations produce identical numeric results to the Java engine, validated against the same reference dataset.

## License

Copyright (C) 2026 Wualabs LTD. Dual-licensed: the [GNU AGPL v3](LICENSE) (only) with the
[QTSurfer Strategy Exception](STRATEGY-EXCEPTION.md), so the strategies you write with the engine stay under
terms of your choice, or a commercial licence from Wualabs. [LICENSING.md](LICENSING.md) says what each one
allows. Contributions need the [Wualabs CLA](CLA.md) ([CONTRIBUTING.md](CONTRIBUTING.md)).

## Security

Report a vulnerability privately to <security@wualabs.com>; see [SECURITY.md](SECURITY.md).
