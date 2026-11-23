# @qtsurfer/core

## 0.17.0

### Minor Changes

- [#8](https://github.com/QTSurfer/engine-ts/pull/8) [`9a72ebc`](https://github.com/QTSurfer/engine-ts/commit/9a72ebcc371a437ea799cbddf8bf54bad6cdfe3a) Thanks [@mrmx](https://github.com/mrmx)! - A strategy is told when a market-data source is attached to it and detached from it. `Strategy` gains `onAttach(context)` and `onDetach(context)`, which do nothing unless a strategy overrides them. The new `StrategyContext`, built with `StrategyContext.builder()`, says which attachment it is, where its data comes from (venue type, exchange, segment and data type, each also as a lower-case name for a caller that compares strings), which instruments it covers, whether the strategy is still warming up and, on a detach, why it ended; its accessors return scalars and two enums, never a collection. `@qtsurfer/core` adds the `VenueType` and `MarketDataSource` enums. `BacktestRunner` calls `onAttach` once before the first data point and `onDetach` once after the last, with the reason `OWNER`, also when an update throws but not when `onAttach` itself threw. Signals emitted from the hooks are handled like any other, and the results of a strategy that does not override them do not change.

## 0.16.0

## 0.15.0

## 0.14.0

## 0.13.0

### Minor Changes

- [`b684d75`](https://github.com/QTSurfer/engine-ts/commit/b684d7596de8f40c63d58ca18a338abd7b99d400) Thanks [@mrmx](https://github.com/mrmx)! - First public release, on npm. The TypeScript port of the QTSurfer engine, licensed by Wualabs LTD under the GNU AGPL v3 with the QTSurfer Strategy Exception, or under a commercial licence (`LICENSING.md`):

  - `@qtsurfer/core`: tickers, klines, instruments and the state and window stores.
  - `@qtsurfer/indicators`: real-time streaming indicators, time windows and the instrument group builder, with the same numbers as the Java engine.
  - `@qtsurfer/strategy`: the strategy classes, the signal hierarchy and the backtest pipeline with its simulation layer and session output.
