---
"@qtsurfer/core": minor
"@qtsurfer/strategy": minor
---

A strategy is told when a market-data source is attached to it and detached from it. `Strategy` gains `onAttach(context)` and `onDetach(context)`, which do nothing unless a strategy overrides them. The new `StrategyContext`, built with `StrategyContext.builder()`, says which attachment it is, where its data comes from (venue type, exchange, segment and data type, each also as a lower-case name for a caller that compares strings), which instruments it covers, whether the strategy is still warming up and, on a detach, why it ended; its accessors return scalars and two enums, never a collection. `@qtsurfer/core` adds the `VenueType` and `MarketDataSource` enums. `BacktestRunner` calls `onAttach` once before the first data point and `onDetach` once after the last, with the reason `OWNER`, also when an update throws but not when `onAttach` itself threw. Signals emitted from the hooks are handled like any other, and the results of a strategy that does not override them do not change.
