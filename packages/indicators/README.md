# @qtsurfer/indicators

Real-time streaming technical indicators for the QTSurfer Engine. 1-a-1 port of the Java engine's indicators module.

```bash
npm install @qtsurfer/indicators
```

All indicators implement the `RTIndicator` interface and produce identical numeric results to the Java engine.

## Indicators

| Category | Class | Description |
|---|---|---|
| Averages | `EmaRTIndicator` | Exponential Moving Average |
| | `SmaRTIndicator` | Simple Moving Average (discrete/continuous mode) |
| | `MmaRTIndicator` | Modified Moving Average |
| | `WmaRTIndicator` | Weighted Moving Average |
| Oscillators | `RsiRTIndicator` | Relative Strength Index |
| Bands | `BollingerBandsRTIndicator` | Bollinger Bands (middle, upper, lower) |
| Bands | `BollingerPercentBRTIndicator` | Bollinger %B: where the price sits between the lower (0) and upper (1) band |
| Numeric | `ValueRTIndicator` | Stores a single value |
| | `ConstantRTIndicator` | Immutable constant |
| | `ReadOnlyRTIndicator` | Read-only delegate wrapper |
| | `TransformRTIndicator` | Applies a transform function (multiply, etc.) |
| | `BiFunctionRTIndicator` | Combines two indicators (plus, minus, multiply) |
| | `SumRTIndicator` | Running sum |
| Helpers | `GainRTIndicator` | Positive price changes |
| | `LossRTIndicator` | Negative price changes (absolute) |
| | `MaxRTIndicator` | Running max |
| | `MinRTIndicator` | Running min |
| | `RateChangeRTIndicator` | Rate of change |
| | `DistanceRTIndicator` | Distance between two indicators |
| | `DistanceFromMaRTIndicator` | Distance from moving average |
| Metadata | `IndicatorMeta` | What an indicator says about itself: type, parameters, source, display, visibility |
| | `DisplayHint` | How a value is presented: `ABSOLUTE`, `PERCENT` or `VOLUME` |
| Groups | `InstrumentGroupRTIndicator` | Fluent builder for indicator sets per instrument |
| | `InstrumentMapRTIndicator` | Named indicator map with read-only access |
| | `InstrumentMapTickerSourceRTIndicator` | Auto-updates indicators from Ticker data |

## Usage

```ts
import { EmaRTIndicator, InstrumentGroupRTIndicator } from "@qtsurfer/indicators";

// Direct usage
const ema = new EmaRTIndicator(14);
ema.update(100);
ema.update(105);
console.log(ema.getValue());

// Fluent builder
const group = new InstrumentGroupRTIndicator("BTC/USDT");
group.addPrice().ema("emaFast", 3).ema("emaSlow", 7).rsi(14).bollinger();
```

## Variance precision

The variance behind `VarianceRTIndicator`, `StandardDeviationRTIndicator` and `BollingerBandsRTIndicator` (the bands, the width and %B) is worked out from the window on every tick by default: exact to the last digits and O(periods) per tick, so the bands keep their width in a quiet market at a high price. `withPrecision("fast")` makes it O(1) again: running sums of the deviations from a reference value near the mean, with a bound on the rounding they gather and an exact pass over the window whenever that bound could cost more than one part in a thousand million of the variance. Its rounding stays below about that bound (a worst-case bound; the tests hold the result to ten times that), but it is not bit-for-bit the exact result, so a strategy that trades on a band edge can enter or leave at a different tick.

```ts
const bands = new BollingerBandsRTIndicator(200, 2).withPrecision("fast"); // O(1) per tick at any period
bands.precision; // "fast"; "exact" is the default
```

About 40 ns per update at any period for `"fast"`, against 60 ns at 20 periods, 380 ns at 200 and 1.6 µs at 1,000 for `"exact"`. The Java engine has the same two precisions and gives the same digits. The precision is set from the API only, not from the IR or QTScript.

## Builder vocabulary

`InstrumentGroupRTIndicator` has the builder methods of the Java engine, each registering under a plain name (`macd`, `cci20`, `stochRsi14`, `clmpprice`, ...) or the name given:

| Group | Methods |
|---|---|
| Oscillators | `rsi`, `macd`, `cci`, `stochRsi` |
| Averages and bands | `sma`, `ema`, `bollinger`, `bollingerBandwidth` |
| Derived | `gain`, `loss`, `max`, `min`, `sum`, `distance`, `distanceMa`, `percentChange`, `rateChange`, `round`, `clamp`, `decorate` |
| Arithmetic | `add`, `diff`, `mul`, `fun` |
| Comparisons | `equal`, `notEqual`, `greatThan`, `greatOrEqual`, `lessThan`, `lessOrEqual`, `predicate`, `periodCount`, `conditional` |
| Registration | `add(name, indicator)`, `add(name, indicator, displayHint)`, `add(name, valueSource)`, `add(name, valueSource, indicator)` |

```ts
group.addPrice().macd().cci(20).stochRsi(14).clamp("price", 0, 100);
group.greatThan("overbought", "rsi14", 70, "price", "ema12"); // the price while rsi14 > 70, else ema12
```

## Names and metadata

An indicator is registered under a plain name and looked up by it: `.rsi(14)` registers `rsi14`, `.distance("price", "ema12")` registers `distpriceema12`, `.percentChange("price")` registers `chgprice`, and `.bollingerBandwidth("bb")` registers `bbBW`. No display suffix is added to a name.

What a name used to carry travels in the indicator's metadata instead. `indicator.getMeta()` returns an `IndicatorMeta` of short string entries, for example `id`, `periods`, `k`, `band`, `src` (the indicator it derives from) and `dsp` (`P` for a percentage, `V` for a volume; absent means absolute). `indicator.getDisplayHint()` is the typed view of `dsp`. `getId()` is the indicator type: the `id` entry when there is one, else the class name without its `RTIndicator` suffix (`RsiRTIndicator` is `rsi`).

```ts
const group = new InstrumentGroupRTIndicator("BTC/USDT").addPrice().rsi(14).bollinger(13, 2);
group.getExisting("rsi14").getDisplayHint?.();   // DisplayHint.PERCENT
group.getExisting("blgr13_2Upper").getMeta?.();  // id=bollinger, periods=13, k=2, band=upper
```

Metadata only describes an indicator. An indicator never reads it to compute, so it never changes a value.

A name that starts with `_` is internal: the indicator is updated on every tick, but `forEachPublicable` does not list it. An indicator can also be marked hidden with `indicator.hide()`.

## Scripts

```bash
pnpm build    # Build with tsup
pnpm test     # Run tests with vitest
pnpm bench    # Run benchmarks
pnpm lint     # Type-check
```

## License

Copyright (C) 2026 Wualabs LTD. The [GNU AGPL v3](LICENSE) (only) with the [QTSurfer Strategy Exception](STRATEGY-EXCEPTION.md):
the strategies you write against this package stay under terms of your choice. A commercial licence is also available.
See [LICENSING.md](LICENSING.md).
