# @qtsurfer/core

Shared types and data structures for the QTSurfer Engine TS packages. Zero dependencies.

```bash
npm install @qtsurfer/core
```

## Exports

### Domain Types

- **`Ticker`** — Market ticker interface (instrument, OHLCV, bid/ask, vwap, timestamp)
- **`TickerValueSource`** — Enum for selecting which ticker field to use as indicator input (Bid, Ask, Close, Volume, AutoAskClose, etc.)
- **`getTickerValue(ticker, source)`** — Extracts the numeric value from a Ticker for a given source
- **`Instrument`** — A CCXT instrument, spot (`"BTC/USDT"`), perpetual (`"BTC/USDT:USDT"`) or dated (`"BTC/USDT:USDT-240628"`): `Instrument.parse(symbol)` and `Instrument.of(...)` build one, `base()`, `quote()`, `symbol()` and `equals()` read it. The `instrument` fields of `Ticker` and `Kline` stay plain strings; `Instrument.parse` turns one into this type
- **`Asset`** — A currency code, upper-cased (`Asset.of("usdt").code === "USDT"`), equal by code
- **`CurrencyHelper`** — Asset-code sets and `¿` wildcard matching behind the strategy currency filter
- **`Currency`** — Type alias for `string`

### Data Structures

- **`WindowSeriesStore`** — Fixed-size circular buffer (ring buffer) for windowed calculations
- **`StateStore`** — Key-value state container for per-instrument strategy state

### Interfaces

- **`Resettable`** — Interface for objects that can be reset to initial state

## Usage

```ts
import type { Ticker } from "@qtsurfer/core";
import { TickerValueSource, getTickerValue } from "@qtsurfer/core";

const ticker: Ticker = {
  instrument: "BTC/USDT",
  last: 50000,
  ask: 50010,
  bid: 49990,
  // ...
};

const price = getTickerValue(ticker, TickerValueSource.AutoAskClose); // 50000
```

## Scripts

```bash
pnpm build    # Build with tsup
pnpm test     # Run tests with vitest
pnpm lint     # Type-check
```

## License

Copyright (C) 2026 Wualabs LTD. The [GNU AGPL v3](LICENSE) (only) with the [QTSurfer Strategy Exception](STRATEGY-EXCEPTION.md):
the strategies you write against this package stay under terms of your choice. A commercial licence is also available.
See [LICENSING.md](LICENSING.md).
