# @qtsurfer/indicators

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
