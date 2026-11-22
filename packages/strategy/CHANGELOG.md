# @qtsurfer/strategy

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
