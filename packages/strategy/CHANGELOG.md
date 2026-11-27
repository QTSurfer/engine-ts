# @qtsurfer/strategy

## 0.19.0

### Minor Changes

- [#13](https://github.com/QTSurfer/engine-ts/pull/13) [`a17abb9`](https://github.com/QTSurfer/engine-ts/commit/a17abb9334beca98e4b16256742400ae056f8520) Thanks [@mrmx](https://github.com/mrmx)! - A backtest applies the detach a strategy asks for. `detach(instrument)` and `detach(context)` emit a `DETACH` system signal that `BacktestRunner` used to ignore, so the strategy went on receiving every data point. From the next data point a detached instrument is read by nobody: neither the strategy nor the simulated venue, so its pending orders and stops stay as they are, and `totalTicks` does not count it. The other instruments go on. When the strategy detaches the attachment of the run (`"backtest"`) or every instrument of the data, the run ends there and `onDetach` is called once with the reason `STRATEGY` instead of `OWNER`; a detach from `onAttach` reads nothing. `onDetach` runs with `setSourceDetaching(true)`, so a `detach(...)` inside it emits nothing. The metrics and the equity curve still span the whole data, whether or not the run was cut short. A strategy that never detaches runs as before. This mirrors the Java engine.

- [#13](https://github.com/QTSurfer/engine-ts/pull/13) [`1fc6243`](https://github.com/QTSurfer/engine-ts/commit/1fc62433738752366b4c58d06580a943627b49a8) Thanks [@mrmx](https://github.com/mrmx)! - A backtest can scale in. A strategy in `ExecutionMode.LONG_MULTI` (`setMultiEntryEnabled(true)`), which the backtest used to store and ignore, now builds its position in steps, as the Java engine's multi-entry pipeline does. Every buy while long adds an entry to the one position, where before it was dropped as `already-long`. The first entry spends `buyPercent` of the cash; each further one spends `buyPercent` of the funds of the run (the initial funding plus what the positions closed so far made, as the Java engine sizes a backtest's entries) and never more than the entries of the open position have not locked (what a partial sell brings back is not funds again until the position closes). A sell sells `sellPercent` percent of what the position holds (100 by default; 0 is dropped as `zero-size`), and a partial sell leaves the rest open with its stops. The protective stop of an entry that asks for one is re-placed for the whole position, and one that asks for none leaves the existing stop covering all of it. The yield is one, when the position closes: what every sell brought in less what every entry cost; `session.trades` shows that as one trade at the average entry and exit price. A strategy in `LONG` runs exactly as before: one entry, and a sell closes the position whatever its `sellPercent`.

- [#13](https://github.com/QTSurfer/engine-ts/pull/13) [`add9103`](https://github.com/QTSurfer/engine-ts/commit/add9103a278b8959907b4579d7a26ab8df1404bb) Thanks [@mrmx](https://github.com/mrmx)! - A buy or sell signal can ask for its own size. `setSizePercent(percent)` takes a number from 0 to 100 (it throws for anything else, NaN included) and `getSizePercent()` reads it, `undefined` when the signal asks for none. It is the share of its own base the signal trades: on a buy, the percent of the funds the entry spends, never more than what the open entries have not locked, which replaces the run's `buyPercent` for that signal only (a size of 0 buys nothing and is dropped as `zero-size`); on a sell, the percent of the open position, as `sellPercent` was. It works in `LONG` and `LONG_MULTI`, so a strategy can buy 10% of the funds, then 20%, then everything that is left. `setSellPercent` stays as the sell side's name and writes the same number, without validating it; `getSellPercent()` is the size, or 100 when there is none. `MarketHintSignal.KEY_SELL_PERCENT` (`"_sellPct"`) is replaced by `KEY_SIZE_PERCENT` (`"_sizePct"`). This mirrors the Java engine.

  Next to it, `setMaxPercent(percent)` / `getMaxPercent()` ask for a share, from 0 to 100, of the most the signal can trade. On a buy that is a share of what the run allows an entry: the `buyPercent` share of the funds, or all that is left unlocked when `buyPercent` is 100, and never more than what is left. 100 is that maximum, `buyPercent` is a ceiling it never passes (a `sizePercent` takes its place), and 0 buys nothing. On a sell the most is the open position, so it means what `sizePercent` means. A signal has one size: `setSizePercent`, `setMaxPercent` and `setSellPercent` each take back the others, and `getSellPercent()` reads `sizePercent`, else `maxPercent`, else 100.

### Patch Changes

- Updated dependencies [[`15406bd`](https://github.com/QTSurfer/engine-ts/commit/15406bd251feb5fa42c2a3fad6010c97c026b3ff)]:
  - @qtsurfer/indicators@0.19.0
  - @qtsurfer/core@0.19.0

## 0.18.0

### Minor Changes

- [#11](https://github.com/QTSurfer/engine-ts/pull/11) [`3de6e97`](https://github.com/QTSurfer/engine-ts/commit/3de6e9715278e8d705f357145cc768059a8abec6) Thanks [@mrmx](https://github.com/mrmx)! - A strategy can ask the platform to detach a market-data source. `detach(instrument)` asks for the source that reads that instrument, and `detach(context)`, for use from `onAttach` and `onDetach`, for the attachment the context describes, named by its id; the signal is about the first instrument of the context, or about its exchange and segment when it has none. Each emits a new `SystemSignal`, of the new event type `StrategyEventType.System` with the action `DETACH`, an optional `attachment` id and an optional `reason`. It is a signal for the platform that hosts the run, not an order: an execution pipeline ignores it, and a host that has no source to detach, such as a backtest, does nothing with it. `setSourceDetaching(boolean)` is for the host: while it is set around `onDetach`, `detach(...)` emits nothing. `StrategyContext.REASON_STRATEGY` (`"STRATEGY"`) is a new detach reason, for an attachment the strategy itself ended, accepted wherever the other reasons are. These mirror the Java engine.

### Patch Changes

- Updated dependencies []:
  - @qtsurfer/core@0.18.0
  - @qtsurfer/indicators@0.18.0

## 0.17.0

### Minor Changes

- [#8](https://github.com/QTSurfer/engine-ts/pull/8) [`9a72ebc`](https://github.com/QTSurfer/engine-ts/commit/9a72ebcc371a437ea799cbddf8bf54bad6cdfe3a) Thanks [@mrmx](https://github.com/mrmx)! - A strategy is told when a market-data source is attached to it and detached from it. `Strategy` gains `onAttach(context)` and `onDetach(context)`, which do nothing unless a strategy overrides them. The new `StrategyContext`, built with `StrategyContext.builder()`, says which attachment it is, where its data comes from (venue type, exchange, segment and data type, each also as a lower-case name for a caller that compares strings), which instruments it covers, whether the strategy is still warming up and, on a detach, why it ended; its accessors return scalars and two enums, never a collection. `@qtsurfer/core` adds the `VenueType` and `MarketDataSource` enums. `BacktestRunner` calls `onAttach` once before the first data point and `onDetach` once after the last, with the reason `OWNER`, also when an update throws but not when `onAttach` itself threw. Signals emitted from the hooks are handled like any other, and the results of a strategy that does not override them do not change.

### Patch Changes

- Updated dependencies [[`17976f0`](https://github.com/QTSurfer/engine-ts/commit/17976f03f382b95a194a7104ab7de3264b2ffdf9), [`9a72ebc`](https://github.com/QTSurfer/engine-ts/commit/9a72ebcc371a437ea799cbddf8bf54bad6cdfe3a)]:
  - @qtsurfer/indicators@0.17.0
  - @qtsurfer/core@0.17.0

## 0.16.0

### Minor Changes

- [#6](https://github.com/QTSurfer/engine-ts/pull/6) [`1c8f2cf`](https://github.com/QTSurfer/engine-ts/commit/1c8f2cf1a1d605879903a2774bdfa3bb8b271d10) Thanks [@mrmx](https://github.com/mrmx)! - A strategy has a global state store. `getGlobalStateStore()` returns the store of the strategy as a whole, created on first use and the same object on every call. It is a namespace of its own: a key written in it is never seen through an instrument's store (`getStateStore(instrument)`, which is unchanged), and the other way round. The windows of an instrument still use that instrument's store.

### Patch Changes

- Updated dependencies [[`f81518f`](https://github.com/QTSurfer/engine-ts/commit/f81518fff27ab53c3bfa90bf2a703e19e0c84138), [`dc30200`](https://github.com/QTSurfer/engine-ts/commit/dc3020010ec49670b6ec6da3d21189d9ee5de57f)]:
  - @qtsurfer/indicators@0.16.0
  - @qtsurfer/core@0.16.0

## 0.15.0

### Patch Changes

- Updated dependencies [[`7abf262`](https://github.com/QTSurfer/engine-ts/commit/7abf262d7daad2a03f1a6cb1536badf37286e916)]:
  - @qtsurfer/indicators@0.15.0
  - @qtsurfer/core@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [[`67c092e`](https://github.com/QTSurfer/engine-ts/commit/67c092e3217c1d5ad0ab7301957e25e781b61c8f)]:
  - @qtsurfer/indicators@0.14.0
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
  - @qtsurfer/indicators@0.13.0
