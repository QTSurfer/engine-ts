# @qtsurfer/indicators

## 0.16.0

### Minor Changes

- [#6](https://github.com/QTSurfer/engine-ts/pull/6) [`dc30200`](https://github.com/QTSurfer/engine-ts/commit/dc3020010ec49670b6ec6da3d21189d9ee5de57f) Thanks [@mrmx](https://github.com/mrmx)! - The free indicators of the builder describe how a chart should draw them, with the same keys as the Java engine. `IndicatorMeta` gains placement (`plc`, drawn over the price), range (`rng`), floor (`flo`), levels (`lvl`), plot style (`sty`), side (`sde`) and drawn-by-default (`drw`), with typed accessors (`isOverlay`, `getRange`, `getFloor`, `getLevels`, `getPlotStyle`, `getPlotSide`, `isDrawnByDefault` and their setters), and constants for the keys of the parameters (`IndicatorMeta.PERIODS`, `K`, `BAND`, `OUTPUT`...). `PlotStyle` and `PlotSide` are new, `DisplayHint` gains `FRACTION` (`F`), `RATIO` (`R`), `INDEX` (`I`) and `NUMBER` (`N`), and `withMeta` accepts a function that edits the metadata.

  Averages (`sma`, `ema`, `wma`, `tema`, `hma`, `mma`, `kama`) and the Bollinger bands are drawn over the price; `cci` and `macd` carry a zero line; `rsi` and `stochRsi` have a 0 to 100 scale; `cci` and `variance` read as pure numbers, `bollingerPercentB` as a ratio, `volatility` and `percentVolatility` as percentages. An average or MACD of another indicator keeps no placement, and a MACD keeps its zero line. No value changes; the unit of `rsi` and `stochRsi` stays a percentage.

### Patch Changes

- [#6](https://github.com/QTSurfer/engine-ts/pull/6) [`f81518f`](https://github.com/QTSurfer/engine-ts/commit/f81518fff27ab53c3bfa90bf2a703e19e0c84138) Thanks [@mrmx](https://github.com/mrmx)! - A read-only view describes the indicator it wraps: the function form of `withMeta` reaches the wrapped indicator, like the key form and `withDisplayHint` already did. `hide()` on a view marks the view only, never the indicator it wraps, and the view reads as hidden. A view registered under an internal name (`_...`) is registered as a view of its own, so hiding that alias no longer hides the same view when it is held by another entry or handed out again by `getReadOnly`.

- Updated dependencies []:
  - @qtsurfer/core@0.16.0

## 0.15.0

### Minor Changes

- [#4](https://github.com/QTSurfer/engine-ts/pull/4) [`7abf262`](https://github.com/QTSurfer/engine-ts/commit/7abf262d7daad2a03f1a6cb1536badf37286e916) Thanks [@mrmx](https://github.com/mrmx)! - `stochRsi(periods)` and `stochRsi(name, periods)` on the group builder now use Wilder's RSI averages, as their name says.
  The previous default, discrete simple averages, held each RSI value for a whole block of `periods` updates, so the
  stochastic collapsed to 0 and 100 on real series. Behaviour change for strategies that use `stochRsi` without the new flag.
  Two overloads, `stochRsi(periods, sma)` and `stochRsi(name, periods, sma)`, pick the averages explicitly: `true` gives the
  previous behaviour. The `StochasticRsiRTIndicator` constructors are unchanged.

### Patch Changes

- Updated dependencies []:
  - @qtsurfer/core@0.15.0

## 0.14.0

### Minor Changes

- [#2](https://github.com/QTSurfer/engine-ts/pull/2) [`67c092e`](https://github.com/QTSurfer/engine-ts/commit/67c092e3217c1d5ad0ab7301957e25e781b61c8f) Thanks [@mrmx](https://github.com/mrmx)! - `InstrumentGroupRTIndicator` registers the indicators that had no builder method: `atr`, `wma` (the O(1) form), `tema`, `hma`, `mma`, `kama`, `stdDev`, `variance`, `volatility`, `percentVolatility` and `bollingerPercentB`. Each has a default id made of a prefix and its parameters (`atr14`, `wma5`, `kama10_2_30`, `pctB20_2`), the same as the Java engine, and `mma`, `stdDev` and `variance` can also read another indicator of the group.

  New `RichRTIndicator` interface for an indicator that reads a whole bar, with the optional `requiresBarData()` flag. `AtrRTIndicator` sets it. When a group is fed from a ticker stream, where high, low and volume are the exchange's 24-hour statistics, it now reports each such indicator once, as an `IndicatorNotice` you read with `getNotices()`; the indicator keeps updating.

### Patch Changes

- Updated dependencies []:
  - @qtsurfer/core@0.14.0

## 0.13.0

### Minor Changes

- [`b684d75`](https://github.com/QTSurfer/engine-ts/commit/b684d7596de8f40c63d58ca18a338abd7b99d400) Thanks [@mrmx](https://github.com/mrmx)! - First public release, on npm. The TypeScript port of the QTSurfer engine, licensed by Wualabs LTD under the GNU AGPL v3 with the QTSurfer Strategy Exception, or under a commercial licence (`LICENSING.md`):

  - `@qtsurfer/core`: tickers, klines, instruments and the state and window stores.
  - `@qtsurfer/indicators`: real-time streaming indicators, time windows and the instrument group builder, with the same numbers as the Java engine.
  - `@qtsurfer/strategy`: the strategy classes, the signal hierarchy and the backtest pipeline with its simulation layer and session output.

### Patch Changes

- Updated dependencies [[`b684d75`](https://github.com/QTSurfer/engine-ts/commit/b684d7596de8f40c63d58ca18a338abd7b99d400)]:
  - @qtsurfer/core@0.13.0
