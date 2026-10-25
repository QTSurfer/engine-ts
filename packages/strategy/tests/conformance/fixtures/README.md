# Backtest conformance fixtures

Hand-verified JSON fixtures that pin the canonical backtest simulation contract:
fill math, fees, sizing, yield production and metric definitions. The
conformance suite (`../backtest-conformance.test.ts`) loads these and asserts the
engine reproduces every canonical number exactly.

## Tiers

| tier | input | exercises |
|------|-------|-----------|
| `metrics` | a list of yield events (input/output/timestamp) | `YieldMetrics` — metric definitions |
| `pipeline` | a scripted buy/sell signal sequence + config | fill math, fees, sizing, yield production |

Pipeline-tier fixtures script the *signals* (not indicator logic) so conformance
is decoupled from indicator parity.

## Conventions

- `expected.canonical` holds the contract numbers; each fixture carries its own
  `tolerances` (`amounts` relative, `ratios` for percent/ratio metrics).
- Scales: a metric whose name ends in `Percent` is 0-100; `winRate` and `cagr` are ratios
  (`cagr` 0.10 is 10%). CAGR does not annualize a span shorter than one year: it is the plain
  equity return there.
- Queued limit, stop and trailing orders resolve against the tick's `last` price only, at the
  start of the next tick (no same-tick lookahead).
- Timestamps are epoch millis; CAGR fixtures space first→last trade an exact
  fraction of 365.25 days so the expected value is closed-form.

## Fee legs

The fee `RATE` (`feeRate`, or per-side `feeRateBuy` / `feeRateSell`) says *how
much*; the `feeLeg` says *in which asset*:

- **RECEIVED** (default): buy fee in BASE, sell fee in QUOTE — the everyday spot
  mechanic. `pipeline-long-roundtrip-fees` and `pipeline-asymmetric-fees`.
- **QUOTE**: fee in QUOTE on both sides (perps / cash-PnL); the buy fee is
  reserved out of the all-in cash at sizing so the balance never goes negative.
  `pipeline-quote-fees`.

## Fixture inventory

| file | tier | pins |
|------|------|------|
| `metrics-mixed-trades.json` | metrics | win iff yield>0, Sortino denominator, equity curve, CAGR over a 365.25-day (exponent-1) span, weeklyReturns (fixed 7-day windows from first yield timestamp) |
| `metrics-cagr-multiyear.json` | metrics | CAGR annualization — two trades exactly two 365.25-day years apart (exponent 1/2) so CAGR (0.10) differs from total return (0.21) |
| `metrics-dirty-returns.json` | metrics | Sharpe and Sortino over the exact per-trade return (returns that are not exact at two significant digits), the equity curve and the weekly vector over a one-year span |
| `pipeline-percent-lock.json` | pipeline | fractional entry sizing: 50% of the available funds is committed, so the round trip trades 5 base (500 quote) and the yield basis is the 500 actually committed |
| `pipeline-maker-taker.json` | pipeline | a maker/taker fee model charges the taker rate on both sides of a market round trip (the maker rate is only for limit fills) |
| `pipeline-limit-fill.json` | pipeline | a queued limit buy resolves on the next tick against `last`, fills at the limit price as maker; the market exit is taker |
| `pipeline-stop-loss.json` | pipeline | a filled buy carrying a stop price places a protective stop sell; it fires on `last` at or below the stop and fills at the stop price |
| `pipeline-trailing-stop.json` | pipeline | percent-from-extreme trailing stop: the extreme starts at the signal price, follows `last` upward, and the stop fires when `last` falls the trail percent from it, filling at that level |
| `pipeline-kline-roundtrip-fees.json` | pipeline | the bar path: the long round-trip numbers replayed as closed flat-OHLC bars through a kline strategy (`BacktestRunner.runKlines`), so the bar path is the same simulation as the ticker path |
| `pipeline-long-roundtrip-fees.json` | pipeline | symmetric 0.1% both-side fees (RECEIVED), all-in buy@100 → sell@110 → net yield 9.78011% |
| `pipeline-asymmetric-fees.json` | pipeline | per-side fee routing — buy 0.1% (base), sell 0.2% (quote) → output 1096.7022 (a single shared rate would land 1097.8011) |
| `pipeline-quote-fees.json` | pipeline | FeeLeg.QUOTE — fee in QUOTE both sides, buy fee reserved at sizing → round trip 1000 → 1097.802198, all fees in quote (2.097902), no base entry |

## Sync rule

These fixtures mirror a canonical source maintained in the Java engine. When a
canonical number changes there, copy the updated numbers here identically —
the prose (`description`, this table) may be adapted for the TS repo, but the
`expected.canonical` values themselves must not. A numeric divergence between
the two engines' conformance suites means a bug in whichever engine changed
last, not a fixture to "fix" locally.
