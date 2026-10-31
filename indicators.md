# Indicators

The indicators `@qtsurfer/indicators` ships: its classes, and the methods of its `InstrumentGroupRTIndicator` that register them.
Update the row in the same change that adds a class or a builder method:
`packages/indicators/tests/IndicatorsDoc.test.ts` fails when a class is missing here or a builder method named here does not exist.

- **Class** — the class exported by `@qtsurfer/indicators`.
- **Builder** — the method of `InstrumentGroupRTIndicator` that registers it by name; `—` when none does, and the class is
  added with `group.add(name, new Class(…))`.
- **Bars** — it reads a whole bar (high, low, close) and not a single value, so it belongs on a kline group: on a ticker those
  are the exchange's 24-hour statistics.

## Summary

| Group | Indicators | With a builder method |
|---|---:|---:|
| Averages | 8 | 2 |
| Oscillators | 4 | 4 |
| Bands | 3 | 2 |
| Volatility | 5 | 0 |
| Distance and change | 4 | 3 |
| Counting and extremes | 6 | 5 |

## Averages

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| SMA | `SmaRTIndicator` | `sma` |  | discrete and moving modes |
| EMA | `EmaRTIndicator` | `ema` |  |  |
| WMA | `WmaRTIndicator` | — |  |  |
| WMA, incremental | `WmaIncrementalRTIndicator` | — |  | O(1) per update |
| TEMA | `TemaRTIndicator` | — |  |  |
| HMA | `HmaRTIndicator` | — |  |  |
| KAMA | `KamaRTIndicator` | — |  |  |
| MMA (Wilder's smoothing) | `MmaRTIndicator` | — |  |  |

## Oscillators

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| RSI | `RsiRTIndicator` | `rsi` |  |  |
| Stochastic RSI | `StochasticRsiRTIndicator` | `stochRsi` |  |  |
| MACD | `MacdRTIndicator` | `macd` |  |  |
| CCI | `CciRTIndicator` | `cci` |  |  |

## Bands

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| Bollinger Bands | `BollingerBandsRTIndicator` | `bollinger` |  |  |
| Bollinger BandWidth | `BollingerBandWidthRTIndicator` | `bollingerBandwidth` |  |  |
| Bollinger %B | `BollingerPercentBRTIndicator` | — |  |  |

## Volatility

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| ATR | `AtrRTIndicator` | — | yes | Wilder's smoothing, O(1) per update; the class does not declare that it reads bars |
| Standard deviation | `StandardDeviationRTIndicator` | — |  |  |
| Variance | `VarianceRTIndicator` | — |  |  |
| Volatility | `VolatilityRTIndicator` | — |  |  |
| % Volatility | `PercentVolatilityRTIndicator` | — |  |  |

## Distance and change

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| Distance | `DistanceRTIndicator` | `distance` |  | `(a - b) / b` |
| Distance from MA | `DistanceFromMaRTIndicator` | `distanceMa` |  | `(close - ma) / ma` |
| Rate of change | `RateChangeRTIndicator` | `rateChange`, `percentChange` |  |  |
| % Change over a period | `PercentChangePeriodRTIndicator` | — |  |  |

## Counting and extremes

| Indicator | Class | Builder | Bars | Notes |
|---|---|---|---|---|
| Gain | `GainRTIndicator` | `gain` |  |  |
| Loss | `LossRTIndicator` | `loss` |  |  |
| Max | `MaxRTIndicator` | `max` |  |  |
| Min | `MinRTIndicator` | `min` |  |  |
| Sum | `SumRTIndicator` | `sum` |  | running sum |
| Count | `CountRTIndicator` | — |  | update counter |

## Derived indicators

Registered by the builder from other indicators; these are not indicators of a price series on their own.

| Class | Builder | What it does |
|---|---|---|
| `BiFunctionRTIndicator` | `fun` | combines two indicators through a binary function |
| `ConditionalRTIndicator` | `conditional` | feeds a value to a `then` indicator when a predicate holds, or to an `else` one |
| `PredicateRTIndicator` | `predicate` | accepts the output while a predicate holds and keeps the last accepted one |
| `PredicatePeriodCounterRTIndicator` | `periodCount` | counts consecutive periods where a predicate holds |
| `ClampRTIndicator` | `clamp` | clamps the output to a range |
| `ClampPredicateRTIndicator` | `clamp` | replaces the output with a fixed value when a predicate matches |
| `RoundRTIndicator` | `round` | rounds the output to a number of decimal places |

The methods `add`, `diff`, `mul`, `equal`, `notEqual`, `greatThan`, `greatOrEqual`, `lessThan` and `lessOrEqual` also register
derived indicators (arithmetic and comparison against another indicator or a number).

## Building blocks

Classes the indicators above and the group are made of. They are not registered by name.

| Class | What it is |
|---|---|
| `InstrumentGroupRTIndicator` | the group of indicators of one instrument, with the builder methods |
| `AbstractDecorableRTIndicator` | the base of the indicators that wrap another one |
| `InstrumentMapRTIndicator` | a map of indicators for an instrument |
| `InstrumentMapKlineSourceRTIndicator` | the map, updated from kline (OHLCV) data |
| `InstrumentMapTickerSourceRTIndicator` | the map, updated from ticker data |
| `KlineRTIndicator` | receives values from kline data through a configurable value source |
| `TickerRTIndicator` | receives values from ticker data through a configurable value source |
| `ValueRTIndicator` | holds a value |
| `ConstantRTIndicator` | holds a constant value |
| `ReadOnlyRTIndicator` | a view of another indicator that does not update it |
| `TransformRTIndicator` | applies a function to the value of another indicator |
| `OnChangeRTIndicator` | notifies listeners when its value changes |
| `PeriodCounterRTIndicator` | counts consecutive periods |
| `WindowTimeRTIndicator` | batches updates over a time window |
