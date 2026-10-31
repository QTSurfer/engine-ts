---
"@qtsurfer/indicators": minor
---

`InstrumentGroupRTIndicator` registers the indicators that had no builder method: `atr`, `wma` (the O(1) form), `tema`, `hma`, `mma`, `kama`, `stdDev`, `variance`, `volatility`, `percentVolatility` and `bollingerPercentB`. Each has a default id made of a prefix and its parameters (`atr14`, `wma5`, `kama10_2_30`, `pctB20_2`), the same as the Java engine, and `mma`, `stdDev` and `variance` can also read another indicator of the group.

New `RichRTIndicator` interface for an indicator that reads a whole bar, with the optional `requiresBarData()` flag. `AtrRTIndicator` sets it. When a group is fed from a ticker stream, where high, low and volume are the exchange's 24-hour statistics, it now reports each such indicator once, as an `IndicatorNotice` you read with `getNotices()`; the indicator keeps updating.
