# @qtsurfer/strategy

Strategy framework for trading signal generation and backtesting. 1-a-1 port of the Java engine's strategy module.

```bash
npm install @qtsurfer/strategy
```

## Architecture

```
AbstractStrategy                    — base: listener management, properties, stats
  └─ AbstractSubscriptionStrategy<T> — indicator groups, crossover detection, signal emission
      └─ AbstractTickerStrategy      — accepts Ticker data, default indicators
```

### Signal Hierarchy

```
StrategyEvent (interface)
  └─ AbstractStrategyEvent           — key-value properties
      └─ StrategySignal (interface)
          └─ AbstractStrategySignal
              └─ InfoStrategySignal
                  └─ EventTypeValueSignal
                      └─ MarketHintSignal  — price, stopLoss, orderKind
                          ├─ BuySignal
                          └─ SellSignal
```

### Execution Pipeline

```
Ticker[] → Strategy.update() → emits BuySignal/SellSignal
  → BacktestExecutionPipeline.handle() → fake fill at signal price + fees
  → produces StrategyYield (input, output, yield%, instrument, currency)
  → YieldMetrics accumulates stats (Sharpe, Sortino, CAGR, drawdown)
```

## Usage

### Strategy Definition

```ts
import { AbstractTickerStrategy, BuySignal, SellSignal } from "@qtsurfer/strategy";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";

class EmaCrossover extends AbstractTickerStrategy {
  private readonly emaCross = new CrossDetector();

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator) {
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 3).ema("emaSlow", 7);
  }

  override update(ticker: Ticker) {
    this.updateInstrument(ticker.instrument, ticker.timestamp);
    const ind = this.updateIndicators(ticker.instrument, ticker);
    const fast = ind.getIndicatorValue("emaFast");
    const slow = ind.getIndicatorValue("emaSlow");

    const cross = this.emaCross.check(fast, slow);
    if (cross.above) {
      this.emitBuy(ticker.instrument, ticker.last ?? 0);
    }
    if (cross.below) {
      this.emitSell(ticker.instrument, ticker.last ?? 0);
    }
  }
}
```

### Strategy Settings

A strategy sets its own configuration from its constructor:

```ts
class Dca extends AbstractTickerStrategy {
  constructor() {
    super("Dca");
    this.setPercentGain(0.5);              // read back with getPercentGain()
    this.setMinGain(2);                    // getMinGain()
    this.setMultiEntryEnabled(true);       // execution mode LONG_MULTI (false: LONG)
    this.setWhitelistedCurrencies(["BTC", "ETH"]);  // base assets; "¿USD" and "USD¿" are wildcards
    this.setBlacklistedCurrencies(["DOGE"]);
    this.setEnableIndicatorsSignals(true);
  }

  // Which instruments the strategy takes. The default keeps the instruments quoted in the
  // output currency (when one is set) whose base the currency filter allows.
  override acceptInstrument(instrument: Instrument): boolean {
    return !instrument.isDerivative() && super.acceptInstrument(instrument);
  }
}
```

`setPercentGain` takes 0 to 100 and `setMinGain` a non-negative number; anything else throws. The strategy only stores them (`getMinPercentGainMultiplier()` gives the percent as a fraction): reading them is up to the strategy. The backtest pipeline runs LONG only, so `setExecutionMode` and `setMultiEntryEnabled` are stored but do not change how it simulates. `getEngineVersion()`, `getEngineVersionMajor()` and `getEngineVersionMinor()` report the version of this package.

### Backtesting

```ts
import { BacktestRunner } from "@qtsurfer/strategy";
import type { Ticker } from "@qtsurfer/core";

const strategy = new EmaCrossover();
const tickers: Ticker[] = loadHistoricalData();

const result = BacktestRunner.run(strategy, tickers, {
  initialFunding: 10000,
  feeRate: 0.001,   // 0.1% per trade
  currency: "USDT",
});

console.log(`Trades: ${result.metrics.totalTrades}`);
console.log(`Win rate: ${(result.metrics.winRate * 100).toFixed(1)}%`);
console.log(`PnL: ${result.metrics.pnlTotal.toFixed(2)}`);
console.log(`Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown: ${result.metrics.maxDrawdownPercent.toFixed(1)}%`);
console.log(`Final balance: ${result.finalBalance.toFixed(2)}`);
```

As in the Java engine, `BacktestRunner` does not call `strategy.accept(...)`: it replays every data point it is given. The instruments a strategy accepts select what is subscribed to or run; a caller that wants to check a session against them asks `strategy.acceptInstrument(Instrument.parse(symbol))`.

### Session output

Besides the KPIs, every run returns what a chart and a results zone draw, collected while the data replays, with no second pass: `result.session`.

```ts
const result = BacktestRunner.run(strategy, tickers, config, { recordIndicators: true });

result.session.markers;     // every signal the strategy emitted: time, price, kind, text, and `ignored` when the emulator dropped it
result.session.equity;      // [{ timestamp, equity }, ...]
result.session.trades;      // one per closed yield: entry, exit, input, output, pnl, exitKind
result.session.fills;       // every simulated fill: side, price, amounts, fee, liquidity, orderKind
result.session.indicators;  // [] unless recordIndicators asked for them
```

- **`markers`**: one per `BuySignal` and `SellSignal` (`BUY @ 100`, `SELL stop @ 90`, with `orderKind`) and one `info` marker per info signal, with its key/value data as `text` and as a plain `data` object and `price` when the signal carries one. The per-tick indicator snapshot a strategy with `enableIndicatorsSignals` emits is left out. The stop a filled entry attaches (`setStopPrice`) is the pipeline's own order, so it has no marker; its fill is in `fills`.
- **`markers[].ignored`**: a marker marks what the strategy *emitted*, and the emulator does not act on every signal: a sell while no position is open, a second buy while one is, a buy with no funds left. The marker of a signal the pipeline dropped without a fill carries `ignored: { reason }`; every other marker has no `ignored` key. The `reason` (type `IgnoredReason`) is `already-long` (a buy while a position is open), `no-position` (a sell with nothing to sell), `no-funds` (a buy with no balance), `zero-size` (a buy or a sell that works out to nothing, `buyPercent` or `sellPercent` at 0), `invalid-order` (a trailing stop with neither a percent nor a distance above zero) or `cancelled` (a queued `stop` order of the strategy, removed when the position closed). A queued order (limit, stop, a market order the fill policy defers) is flagged when it resolves into one of those states, not when it is sent; one still queued when the run ends is not flagged. Info markers are never flagged. To draw what the emulator did, leave out the flagged markers: the buy and sell markers that remain match the fills one to one, except the exit fills of the protective stops an entry attached, which have no marker.
- **`equity`**: the first point is at the time of the first data point replayed, at `initialFunding`; then one point per closed trade, at the time of that trade's exit fill (so the times only move forward), at `initialFunding` plus the cumulative PnL. No data gives `[]`. `result.metrics.equityCurve` is unchanged, and `result.metrics.equityPoints` holds the same running equity with the timestamps, without the first point.
- **`fills`**: `timestamp` is the data time of the point the fill resolved on, so a limit order that waited shows the time it filled, not the time it was sent. `fee` is in `feeAsset`: the base asset for a buy under `FeeLeg.RECEIVED`, the quote currency otherwise. `orderKind` is the kind of the order that filled: `market`, `limit`, `stop` or `stopTrailing`, a protective stop included.
- **`trades`**: built from the entry fill, the exit fill and the yield. A partial sell gives one trade per sell, each on its share of the entry.
- **`indicators`**: with `recordIndicators: true` each public indicator of each instrument is sampled after every data point of that instrument; `['ema9', 'rsi14']` keeps only the named ones. A series has `instrument`, `name`, `id` (the indicator type), `display` (`ABSOLUTE`, `PERCENT` or `VOLUME`), the `timestamps` of the instrument (shared by its series) and the `values`, `null` while the indicator is not ready. Hidden indicators (windows and `_` helpers) are not recorded. Recording reads the indicators and changes no computed value. `runKlines` takes the same options.

To follow fills as they happen, give the pipeline an `onFill(fill)` in its callback (see below), and an `onIgnored(signal, reason)` to hear of the signals it drops; both are optional.

### Manual Pipeline Wiring

```ts
import { BacktestExecutionPipeline, YieldMetrics } from "@qtsurfer/strategy";

const pipeline = new BacktestExecutionPipeline(strategy, config, {
  onFilledBuy(r)  { console.log("BUY filled @", r.price); },
  onFilledSell(r) { console.log("SELL filled @", r.price, "fee:", r.feeAmount); },
  onFill(f)       { console.log(f.side, f.orderKind, f.liquidity, "@", f.price); },  // optional
  onIgnored(s, reason) { console.log("dropped", s.kind, s.orderKind, reason); },       // optional
  onYield(y)      { console.log("Yield:", y.getYieldPercent().toFixed(2), "%"); },
});

strategy.onSignal((signal) => pipeline.handle(signal));
```

## Strategy Properties

A strategy declares properties the way the Java engine does with `@StrategyProperty`: a name, a description, a type (`int`, `long`, `double`, `boolean`, `String`, `duration` in milliseconds), a default, and optional `min`/`max`/`step` hints for sweeps and editors. TypeScript has no annotations, so the class lists them from its constructor, after `super()`, naming the field that receives each value.

```ts
class MyStrategy extends AbstractTickerStrategy {
  emaFast!: number;

  constructor() {
    super("MyStrategy");
    this.declareProperties([
      { name: "ema.fast", description: "Fast EMA period", type: "int", defaultValue: 9, field: "emaFast", min: 2, max: 50, step: 1 },
    ]);
  }
}

strategy.getPropertyDefs();          // the definitions, in the order they were declared
strategy.setProperty("ema.fast", "14"); // true: converted to 14 and written to emaFast
```

- `setProperty(name, value)` converts the value to the declared type as the Java engine does (`"14"` is 14, `14.7` is 14 for an `int`, only the text `true` is a true `boolean`, a number is refused for a `String`), writes it through the strategy's `set<Field>` method when it has one and to the field otherwise, and returns whether it did. A value that does not convert is not applied. A name nobody declared is kept in the property map, where nothing reads it. `min`, `max` and `step` never reject a value.
- A default is applied at the strategy's first use (the first update, or the first read or set of a property), not at construction: the fields of a subclass are defined after the base constructor returns and would overwrite it. A value set before that still wins.
- `registerProperty(def, { get, set })` binds a property to accessors instead of a field. `RESERVED_PROPERTY_KEYS` lists the names the Java engine registers on every strategy, which a property of yours must not reuse.

## Key Features

- **Signal emission** via listener pattern (replaces Java RxJava Observable)
- **Crossover detection** (`CrossDetector` — one instance per watched pair, both directions from one `check`)
- **Indicator groups** per instrument via `InstrumentGroupRTIndicator`
- **Default indicators** — a ticker strategy registers `price`, `chg` (percent change), `vwap`, `volAsk` and `volBid`. A registered name carries no display suffix, so `getIndicatorValue("chg")` reads the percent change and `"chg%"` does not resolve
- **State store** per instrument for custom strategy state
- **Backtest execution** — synchronous LONG pipeline with fake fills and configurable fees
- **Yield tracking** — `StrategyYield` with input/output/yield%
- **Performance metrics** — Sharpe ratio, Sortino ratio, CAGR, max drawdown, win rate (`winRate` and `cagr` are ratios, 0.15 is 15%; fields ending in `Percent` are 0-100; CAGR is not annualized for spans under one year)
- **Strategy stats** (yield tracking, PnL ratio, instrument update counts)

## Backtest Execution Model

The `BacktestExecutionPipeline` implements a synchronous LONG-only state machine:

| State | On BuySignal | On SellSignal |
|-------|-------------|---------------|
| `IDLE` | Enter position at signal price → `EXECUTING` | Ignored |
| `EXECUTING` | Ignored | Unwind (full or partial), emit yield → `EXECUTING` / `IDLE` |

With the legacy config shape (`initialFunding`, `feeRate`, `currency`), the pipeline fills immediately at `signal.price`, spends 100% of the balance on buy, closes 100% of the position on sell, and charges `grossAmount * feeRate` on sell only.

### Simulation options (opt-in)

Every extra field on `BacktestConfig` is optional; omitting them preserves the legacy semantics. Mix and match as needed:

| Field | Effect | Default |
|-------|--------|---------|
| `feeRateBuy` | Fee charged on buy as `cashToSpend * feeRateBuy`. | `0` (buys fee-free) |
| `feeRateSell` | Overrides `feeRate` for the sell side. | `feeRate` |
| `slippageBps` | Adverse price slippage in basis points. Buy fills at `price * (1 + bps/10000)`; sell fills at `price * (1 - bps/10000)`. | `0` |
| `buyPercent` | Fraction (0–100) of available balance spent per buy signal. Residual cash stays in `balance`. | `100` |
| `signal.sellPercent` *(per-signal, not config)* | Fraction (0–100) of the open position to unwind on a sell signal. When < 100 the pipeline stays `EXECUTING` with a proportionally reduced `enterResult` until the base amount is fully closed. Set via `new SellSignal(...).setSellPercent(50)`. | `100` |

```ts
const result = BacktestRunner.run(strategy, tickers, {
  initialFunding: 10000,
  feeRate: 0.001,        // fallback for sell
  feeRateBuy: 0.001,     // now charge symmetric fees
  slippageBps: 5,        // 0.05% adverse slippage per side
  buyPercent: 50,        // enter with half of available cash
  currency: "USDT",
});
```

The yield emitted on a partial sell prorates the cost basis: `input = enterResult.counterAmount * sellFraction`, `output = grossAmount - sellFee`. Each partial fill produces its own `StrategyYield` so metrics (win rate, Sharpe, drawdown) stay coherent across scale-outs.

### Pluggable simulation models

For richer simulation, supply your own `FeeModel` or `SlippageModel` through `BacktestConfig`. When set, they take precedence over the flat-rate shortcuts (`feeRate*`, `slippageBps`).

```ts
import {
  BacktestRunner,
  FixedFeeModel,
  BarRangeSlippage,
} from "@qtsurfer/strategy";

const result = BacktestRunner.run(strategy, tickers, {
  initialFunding: 10_000,
  feeRate: 0,                          // unused when feeModel is set
  currency: "USDT",
  feeModel: new FixedFeeModel(0.001, 0.001), // symmetric taker-style fee
  slippageModel: new BarRangeSlippage(0.5),  // mid-range slippage per bar
});
```

| Built-in | Behavior |
|----------|----------|
| `FixedFeeModel(buyRate, sellRate)` | Flat per-side percentage of the gross counter amount. Ignores maker/taker. |
| `MakerTakerFeeModel(makerRate, takerRate)` | Exchange-style schedule. Limit fills are maker; market, stop and trailing-stop fills are taker. Accepts a negative maker rate for rebate-style schedules. |
| `NoSlippage()` | Fills at the signal price. |
| `FixedBpsSlippage(bps)` | Adverse slippage in basis points, independent of the bar. |
| `BarRangeSlippage(bias)` | Interpolates between signal price (`bias=0`) and adverse bar extreme (`bias=1`). Requires the pipeline to see each ticker. |

The pipeline classifies every fill as **maker** (passive — limit orders that got their price) or **taker** (aggressive — market orders, triggered stops, triggered trailing stops). The liquidity role is exposed on `FeeContext.liquidity` so custom `FeeModel` implementations can route fees accordingly, and it is also what drives the slippage bypass for limit fills.

Custom models implement a single method:

```ts
const feeModel: FeeModel = {
  compute: (ctx) => /* fee amount in counter currency */ ...,
};
const slippageModel: SlippageModel = {
  adjust: (ctx) => /* effective price */ ...,
};
```

Slippage models that depend on the current bar (high/low, volume, …) need the pipeline to know which bar is active. `BacktestRunner` already wires this up — it calls `pipeline.onTicker(ticker)` before each `strategy.update(ticker)` so any signal emitted during that update resolves its fill with the correct bar context. When driving the pipeline manually, call `onTicker` yourself.

### Fill policies — removing look-ahead bias

`ImmediateFill` (default) reproduces the legacy behavior: a signal emitted on bar *N* fills at `signal.price` during that same bar. For bar-close strategies this is optimistic — the strategy effectively "sees the close" and acts on it at the same timestamp.

`NextBarOpenFill` defers every signal to the next bar's open:

```ts
import { BacktestRunner, NextBarOpenFill } from "@qtsurfer/strategy";

BacktestRunner.run(strategy, tickers, {
  initialFunding: 10_000,
  feeRate: 0.001,
  currency: "USDT",
  fillPolicy: new NextBarOpenFill(),
});
```

The pipeline maintains an internal FIFO queue of deferred signals. On each `onTicker(ticker)`, the policy is asked to resolve each pending signal against the incoming bar (returning a reference price or `null` to keep waiting). Slippage then applies on top of the resolved price. If a deferred bar has no `open`, `NextBarOpenFill` falls back to the original `signal.price` so the queue never blocks indefinitely.

Custom policies plug in by implementing two methods:

```ts
const policy: FillPolicy = {
  isImmediate: (signal) => /* true to fill now, false to queue */ ...,
  resolvePending: (signal, ticker) => /* return fill price, or null to wait */ ...,
};
```

This is the same hook that the limit/stop order resolver uses — a limit order is simply a deferred signal that resolves when the tick's last price reaches its target.

### Limit and stop orders

The pipeline executes `OrderKind.market` signals through the configured `FillPolicy` (immediate by default). Non-market orders are always queued and resolved against subsequent ticks' `last` price by their own built-in trigger logic — users don't need to opt in.

| Order kind | Emit with | Triggers when | Fill price | Slippage |
|------------|-----------|--------------|------------|----------|
| `limit` (buy) | `new BuySignal(s, i, limit).setOrderKind(OrderKind.limit)` | `last ≤ limit` | `limit` | none (passive fill) |
| `limit` (sell, take-profit) | `new SellSignal(s, i, limit).setOrderKind(OrderKind.limit)` | `last ≥ limit` | `limit` | none |
| `stop` (buy, breakout) | `new BuySignal(s, i, trigger).setOrderKind(OrderKind.stop)` | `last ≥ stop` | stop | applied (becomes market) |
| `stop` (sell, stop-loss) | `new SellSignal(s, i, trigger).setOrderKind(OrderKind.stop)` | `last ≤ stop` | stop | applied |
| `stopTrailing` (sell) | `new SellSignal(s, i, ref).setOrderKind(OrderKind.stopTrailing).setTrailPercent(p)` | `last ≤ peak × (1 − p/100)` | `peak × (1 − p/100)` | applied |
| `stopTrailing` (buy) | `new BuySignal(s, i, ref).setOrderKind(OrderKind.stopTrailing).setTrailPercent(p)` | `last ≥ trough × (1 + p/100)` | `trough × (1 + p/100)` | applied |

Stop orders trigger on `signal.price`. Trailing stops need `setTrailPercent(p)` (percent of the running extreme) or `setTrailDistance(d)` (absolute price units, used when no percent is set) — the pipeline keeps a running peak (sell trail) or trough (buy trail) keyed by the signal instance, seeded with the signal's own price and advanced by `last` on every tick; the stop level is the extreme `∓` the percent or distance, and a price that sets a new extreme moves the level instead of firing. Signals with neither are dropped silently. Non-market orders do not fill on the same tick that emitted them — resolution starts from the next `onTicker` call, which avoids look-ahead bias.

A filled buy that carries `signal.setStopPrice(...)` also places a protective stop sell at that price (first eligible on the next tick, selling whatever position is held when it fires); closing the position cancels any `stop` orders still queued. A `stop` order does not get a second one, since its own `getStopPrice()` is its trigger.

Resolution reads only the tick's `last`; high and low are never consulted, and a tick with `null` last leaves every limit, stop and trailing order pending. Limit/stop orders respect the same state machine as market orders: a second buy queued behind an already-pending buy will fill in FIFO order if both get triggered, but will be silently dropped if the first one flipped the pipeline into `EXECUTING` first.

Strategies emit non-market orders by constructing the signal directly and setting the order kind. The `emitBuy` / `emitSell` helpers always produce market orders today; for everything else, build the signal and call `emitSignal`:

```ts
import {
  AbstractTickerStrategy,
  BuySignal,
  SellSignal,
} from "@qtsurfer/strategy";
import { OrderKind } from "@qtsurfer/strategy";

class BreakoutWithStopLoss extends AbstractTickerStrategy {
  override update(ticker: Ticker) {
    const inst = ticker.instrument;
    this.updateInstrument(inst, ticker.timestamp);
    const ind = this.updateIndicators(inst, ticker);
    const last = ticker.last ?? 0;

    const high20 = ind.getIndicatorValue("max20");
    const low10 = ind.getIndicatorValue("min10");

    // Buy on a breakout above the 20-bar high — stop entry, becomes market.
    if (last >= high20 * 0.99 && high20 > 0) {
      const entry = new BuySignal(this.name, inst, high20)
        .setOrderKind(OrderKind.stop);
      this.emitSignal(entry);
    }

    // Static stop-loss at the 10-bar low (sell on break below).
    if (low10 > 0) {
      const stopLoss = new SellSignal(this.name, inst, low10)
        .setOrderKind(OrderKind.stop);
      this.emitSignal(stopLoss);
    }

    // Take-profit limit, scale-out half on a 5% rally above last.
    const target = last * 1.05;
    const tp = new SellSignal(this.name, inst, target)
      .setOrderKind(OrderKind.limit)
      .setSellPercent(50);
    this.emitSignal(tp);
  }
}
```

### Risk management patterns

The pipeline's single-position LONG state machine composes naturally with the order kinds. A few recipes you will reach for often:

**Market entry with a hard stop-loss and fixed take-profit.** The static stop caps worst-case loss; the limit scale-out harvests half of the position on a rally.

```ts
const last = ticker.last ?? 0;

this.emitBuy(inst, last);

// Hard stop 2% below entry — triggers even if the strategy stops emitting.
this.emitSignal(
  new SellSignal(this.name, inst, last * 0.98).setOrderKind(OrderKind.stop),
);

// Scale-out half the position at +3%.
this.emitSignal(
  new SellSignal(this.name, inst, last * 1.03)
    .setOrderKind(OrderKind.limit)
    .setSellPercent(50),
);
```

**Market entry with a trailing stop.** The trail ratchets upward with the peak, letting winners run while still enforcing an exit if the move reverses.

```ts
this.emitBuy(inst, ticker.last ?? 0);

this.emitSignal(
  new SellSignal(this.name, inst, ticker.last ?? 0)
    .setOrderKind(OrderKind.stopTrailing)
    .setTrailDistance(5), // absolute price units
);
```

**Breakout entry with an immediate protective stop.** The buy-stop only fills on a breakout above `high20`; the sell-stop below the breakout level is emitted ahead of time and simply waits in the queue — it only becomes relevant once the entry has filled and the pipeline is `EXECUTING`.

```ts
const high20 = ind.getIndicatorValue("max20");
const low10 = ind.getIndicatorValue("min10");

this.emitSignal(
  new BuySignal(this.name, inst, high20).setOrderKind(OrderKind.stop),
);
this.emitSignal(
  new SellSignal(this.name, inst, low10).setOrderKind(OrderKind.stop),
);
```

**Take-profit + trailing stop combo.** Limit order locks a partial gain; the trail protects what is left.

```ts
const last = ticker.last ?? 0;

this.emitBuy(inst, last);

this.emitSignal(
  new SellSignal(this.name, inst, last * 1.05)
    .setOrderKind(OrderKind.limit)
    .setSellPercent(40),
);
this.emitSignal(
  new SellSignal(this.name, inst, last)
    .setOrderKind(OrderKind.stopTrailing)
    .setTrailDistance(last * 0.02), // 2% trail
);
```

A few things to keep in mind when combining orders:

- **FIFO**: queued orders resolve in the order they were emitted. If two sells would trigger on the same bar, the first one to fire flips the pipeline to `IDLE` and silently drops the remainder.
- **Partial sells** keep the pipeline `EXECUTING`, so a scale-out limit followed by a trailing stop will both participate in the same position until the base amount is fully closed.
- **Trailing stops are stateful per signal instance**. Emitting a fresh trail on every bar would queue many of them — emit once per position and let the pipeline manage the state.
- **Limit fills skip slippage** (passive fill at your price); **stop and trailing-stop fills apply slippage** (trigger converts to market).

## Scripts

```bash
pnpm build    # Build with tsup
pnpm test     # Run tests with vitest (211 tests)
pnpm lint     # Type-check
```

## License

Copyright (C) 2026 Wualabs LTD. The [GNU AGPL v3](LICENSE) (only) with the [QTSurfer Strategy Exception](STRATEGY-EXCEPTION.md):
the strategies you write against this package stay under terms of your choice. A commercial licence is also available.
See [LICENSING.md](LICENSING.md).
