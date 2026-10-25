# Indicators

Where each indicator of the Java engine stands in this port: whether `@qtsurfer/indicators` has a class
for it, and whether a builder can register it. Update the row in the same change that ports an indicator
or adds a builder method.

- **TS class** — the class in `@qtsurfer/indicators`; `—` when it is not ported.
- **TS builder** — the method of this package's `InstrumentGroupRTIndicator` that registers it: what a
  TypeScript strategy and the Lab build with.
- **Java builder** — the method of the Java engine's `InstrumentGroupRTIndicator`. A QTScript `setup:` line
  is one call on that builder: the server compiles it against the Java class and the Lab checks it against
  the same vocabulary, so this column is also **what QTScript can write**. A method in the TS builder only is
  usable from TypeScript, not yet from QTScript.
- **Pro** — the Java engine's pro module (`qtsurfer-engine-indicators-pro`) registers through `Pro.on(group)`,
  not through the builder, so QTScript cannot reach it yet. **Bars** marks the indicators that read a whole bar (high, low, volume…): on a
  ticker those are the exchange's 24-hour statistics, so they belong on a kline group.

## Summary

| Module | Indicators | TS class | TS builder | Java builder / `Pro.on` |
|---|---:|---:|---:|---:|
| Base (`qtsurfer-engine-indicators`) | 28 | 27 | 16 | 16 |
| Pro (`qtsurfer-engine-indicators-pro`) | 84 | 2 | 0 | 8 |

Ported but registered by no builder (so out of QTScript's reach): WMA, TEMA, HMA, KAMA, MMA, Bollinger %B, Standard deviation, Variance, Volatility, % Volatility, % Change over a period.

## Base module

Java classes under `com.wualabs.qtsurfer.engine.indicators`.

### Averages

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| SMA | `averages.SmaRTIndicator` | `SmaRTIndicator` | `sma(…)` | `sma(…)` |  |
| EMA | `averages.EmaRTIndicator` | `EmaRTIndicator` | `ema(…)` | `ema(…)` |  |
| WMA | `averages.WmaRTIndicator` | `WmaRTIndicator` | — | — |  |
| TEMA | `averages.TemaRTIndicator` | `TemaRTIndicator` | — | — |  |
| HMA | `averages.HmaRTIndicator` | `HmaRTIndicator` | — | — |  |
| KAMA | `averages.KamaRTIndicator` | `KamaRTIndicator` | — | — |  |
| MMA | `averages.MmaRTIndicator` | `MmaRTIndicator` | — | — |  |

### Oscillators

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| RSI | `momentum.RsiRTIndicator` | `RsiRTIndicator` | `rsi(…)` | `rsi(…)` |  |
| Stochastic RSI | `momentum.StochasticRsiRTIndicator` | `StochasticRsiRTIndicator` | `stochRsi(…)` | `stochRsi(…)` |  |
| MACD | `momentum.MacdRTIndicator` | `MacdRTIndicator` | `macd(…)` | `macd(…)` |  |
| CCI | `momentum.CciRTIndicator` | `CciRTIndicator` | `cci(…)` | `cci(…)` |  |

### Bands

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| Bollinger Bands | `bollinger.BollingerBandsRTIndicator` | `BollingerBandsRTIndicator` | `bollinger(…)` | `bollinger(…)` |  |
| Bollinger BandWidth | `bollinger.BollingerBandWidthRTIndicator` | `BollingerBandWidthRTIndicator` | `bollingerBandwidth(…)` | `bollingerBandwidth(…)` |  |
| Bollinger %B | `bollinger.BollingerPercentBRTIndicator` | `BollingerPercentBRTIndicator` | — | — |  |

### Volatility

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| Standard deviation | `statistics.StandardDeviationRTIndicator` | `StandardDeviationRTIndicator` | — | — |  |
| Variance | `statistics.VarianceRTIndicator` | `VarianceRTIndicator` | — | — |  |
| Volatility | `helpers.VolatilityRTIndicator` | `VolatilityRTIndicator` | — | — |  |
| % Volatility | `helpers.PercentVolatilityRTIndicator` | `PercentVolatilityRTIndicator` | — | — |  |

### Helpers

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| Distance | `distance.DistanceRTIndicator` | `DistanceRTIndicator` | `distance(…)` | `distance(…)` |  |
| Distance from MA | `distance.DistanceFromMaRTIndicator` | `DistanceFromMaRTIndicator` | `distanceMa(…)` | `distanceMa(…)` |  |
| Gain | `helpers.GainRTIndicator` | `GainRTIndicator` | `gain(…)` | `gain(…)` |  |
| Loss | `helpers.LossRTIndicator` | `LossRTIndicator` | `loss(…)` | `loss(…)` |  |
| Max | `helpers.MaxRTIndicator` | `MaxRTIndicator` | `max(…)` | `max(…)` |  |
| Min | `helpers.MinRTIndicator` | `MinRTIndicator` | `min(…)` | `min(…)` |  |
| Sum | `numeric.SumRTIndicator` | `SumRTIndicator` | `sum(…)` | `sum(…)` |  |
| % Change over a period | `helpers.PercentChangePeriodRTIndicator` | `PercentChangePeriodRTIndicator` | — | — |  |

### Other

| Indicator | Java class | TS class | TS builder | Java builder | Notes |
|---|---|---|---|---|---|
| Rate of change | `helpers.RateChangeRTIndicator` | `RateChangeRTIndicator` | `rateChange(…)`, `percentChange(…)` | `rateChange(…)`, `percentChange(…)` |  |
| Funding rate | `helpers.FundingRateRTIndicator` | — | — | — | the funding-rate data source is not ported |

## Pro module

Java classes under `com.wualabs.qtsurfer.engine.indicators`; 33 of them read whole bars. The TS ports
of the pro WMA and ATR live in `@qtsurfer/indicators` (`WmaIncrementalRTIndicator`, `AtrRTIndicator`), registered by no
builder yet (the Java builder comes first), and end on the same digits as the Java classes (`packages/indicators/bench/cross-runtime/`). The four OHLC volatility
estimators marked "OHLC, not declared" take a bar's prices but do not say they need bars in the Java engine.

### Averages

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| ALMA | `averages.pro.AlmaRTIndicator` |  | — | — | — |  |
| DEMA | `averages.pro.DemaRTIndicator` |  | — | — | — |  |
| Envelopes | `averages.pro.EnvelopesRTIndicator` |  | — | — | — |  |
| FRAMA | `averages.pro.FramaRTIndicator` |  | — | — | — |  |
| LSMA | `averages.pro.LeastSquaresMovingAverageRTIndicator` |  | — | — | — |  |
| McGinley Dynamic | `averages.pro.McGinleyDynamicRTIndicator` |  | — | — | — |  |
| SMMA | `averages.pro.SmmaRTIndicator` |  | — | — | — |  |
| WMA (O(1)) | `averages.pro.WmaRTIndicator` |  | `WmaIncrementalRTIndicator` | — | — |  |

### Trend

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| ADX / DMI | `trend.pro.AdxRTIndicator` | yes | — | — | `adx(…)` |  |
| Aroon | `trend.pro.AroonRTIndicator` | yes | — | — | — |  |
| Chande Kroll Stop | `trend.pro.ChandeKrollStopRTIndicator` | yes | — | — | — |  |
| Chandelier Exit | `trend.pro.ChandelierExitRTIndicator` | yes | — | — | — |  |
| Donchian Channel | `trend.pro.DonchianChannelRTIndicator` | yes | — | — | — |  |
| Efficiency Ratio | `trend.pro.EfficiencyRatioRTIndicator` |  | — | — | — |  |
| Ichimoku | `trend.pro.IchimokuRTIndicator` | yes | — | — | `ichimoku(…)` |  |
| Parabolic SAR | `trend.pro.ParabolicSarRTIndicator` | yes | — | — | — |  |
| SuperTrend | `trend.pro.SuperTrendRTIndicator` | yes | — | — | `superTrend(…)` |  |
| Vortex | `trend.pro.VortexRTIndicator` | yes | — | — | — |  |

### Momentum

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| Accelerator Oscillator | `momentum.pro.AcceleratorOscillatorRTIndicator` | yes | — | — | — |  |
| Adaptive Fisher Transform | `momentum.pro.AdaptiveFisherTransformRTIndicator` |  | — | — | — |  |
| Awesome Oscillator | `momentum.pro.AwesomeOscillatorRTIndicator` | yes | — | — | — |  |
| Balance Of Power | `momentum.pro.BalanceOfPowerRTIndicator` | yes | — | — | — |  |
| Bull Bear Power | `momentum.pro.BullBearPowerRTIndicator` | yes | — | — | — |  |
| Chande Forecast Oscillator | `momentum.pro.ChandeForecastOscillatorRTIndicator` |  | — | — | — |  |
| CMO | `momentum.pro.CmoRTIndicator` |  | — | — | — |  |
| Connors RSI | `momentum.pro.ConnorsRsiRTIndicator` |  | — | — | — |  |
| Coppock Curve | `momentum.pro.CoppockCurveRTIndicator` |  | — | — | — |  |
| Detrended Price Oscillator (DPO) | `momentum.pro.DetrendedPriceOscillatorRTIndicator` |  | — | — | — |  |
| Fisher Transform | `momentum.pro.FisherTransformRTIndicator` |  | — | — | — |  |
| Know Sure Thing (KST) | `momentum.pro.KnowSureThingRTIndicator` |  | — | — | — |  |
| Momentum | `momentum.pro.MomentumRTIndicator` |  | — | — | — |  |
| Relative Vigor Index (RVI) | `momentum.pro.RelativeVigorIndexRTIndicator` | yes | — | — | — |  |
| ROC | `momentum.pro.RocRTIndicator` |  | — | — | — |  |
| Stochastic Oscillator | `momentum.pro.StochasticOscillatorRTIndicator` | yes | — | — | — |  |
| TRIX | `momentum.pro.TrixRTIndicator` |  | — | — | — |  |
| True Strength Index (TSI) | `momentum.pro.TrueStrengthIndexRTIndicator` |  | — | — | — |  |
| Ultimate Oscillator | `momentum.pro.UltimateOscillatorRTIndicator` | yes | — | — | — |  |
| Williams %R | `momentum.pro.WilliamsRRTIndicator` | yes | — | — | — |  |

### Volatility

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| ATR | `volatility.pro.AtrRTIndicator` | yes | `AtrRTIndicator` | — | `atr(…)` |  |
| Choppiness Index | `volatility.pro.ChoppinessIndexRTIndicator` | yes | — | — | — |  |
| Keltner Channel | `volatility.pro.KeltnerChannelRTIndicator` | yes | — | — | — |  |
| Mass Index | `volatility.pro.MassIndexRTIndicator` | yes | — | — | — |  |
| NATR | `volatility.pro.NatrRTIndicator` | yes | — | — | — |  |
| Relative Volatility Index | `volatility.pro.RelativeVolatilityIndexRTIndicator` |  | — | — | — |  |

### Volume

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| ADL | `volume.pro.AdlRTIndicator` | yes | — | — | — |  |
| Chaikin Oscillator | `volume.pro.ChaikinOscillatorRTIndicator` | yes | — | — | — |  |
| CMF | `volume.pro.CmfRTIndicator` | yes | — | — | `cmf(…)` |  |
| Ease Of Movement | `volume.pro.EaseOfMovementRTIndicator` | yes | — | — | — |  |
| Elder Force Index | `volume.pro.ElderForceIndexRTIndicator` | yes | — | — | — |  |
| Klinger Oscillator | `volume.pro.KlingerOscillatorRTIndicator` | yes | — | — | — |  |
| MFI | `volume.pro.MfiRTIndicator` | yes | — | — | `mfi(…)` |  |
| Negative Volume Index | `volume.pro.NegativeVolumeIndexRTIndicator` | yes | — | — | — |  |
| OBV | `volume.pro.ObvRTIndicator` | yes | — | — | `obv(…)` |  |
| PVT | `volume.pro.PvtRTIndicator` | yes | — | — | — |  |
| VWAP | `volume.pro.VwapRTIndicator` | yes | — | — | `vwap(…)` |  |

### Statistics

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| Autocorrelation | `statistics.pro.AutocorrelationRTIndicator` |  | — | — | — |  |
| Beta | `statistics.pro.BetaRTIndicator` |  | — | — | — |  |
| Correlation | `statistics.pro.CorrelationRTIndicator` |  | — | — | — |  |
| Covariance | `statistics.pro.CovarianceRTIndicator` |  | — | — | — |  |
| Hurst Exponent | `statistics.pro.HurstExponentRTIndicator` |  | — | — | — |  |
| Kurtosis | `statistics.pro.KurtosisRTIndicator` |  | — | — | — |  |
| Linear Regression Slope | `statistics.pro.LinearRegressionSlopeRTIndicator` |  | — | — | — |  |
| Rolling Percentile | `statistics.pro.RollingPercentileRTIndicator` |  | — | — | — |  |
| Simple Linear Regression | `statistics.pro.SimpleLinearRegressionRTIndicator` |  | — | — | — |  |
| Skewness | `statistics.pro.SkewnessRTIndicator` |  | — | — | — |  |
| Standard Deviation | `statistics.pro.StandardDeviationRTIndicator` |  | — | — | — | the base deviation is ported (`StandardDeviationRTIndicator`) |
| Value at Risk | `statistics.pro.ValueAtRiskRTIndicator` |  | — | — | — |  |
| Variance | `statistics.pro.VarianceRTIndicator` |  | — | — | — | the base variance is ported (`VarianceRTIndicator`) |
| Z-score | `statistics.pro.ZScoreRTIndicator` |  | — | — | — |  |

### Statistics: volatility estimators

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| EWMA volatility | `statistics.pro.volatility.EwmaVolatilityRTIndicator` |  | — | — | — |  |
| Garman-Klass volatility | `statistics.pro.volatility.GarmanKlassVolatilityRTIndicator` | OHLC, not declared | — | — | — |  |
| Parkinson volatility | `statistics.pro.volatility.ParkinsonVolatilityRTIndicator` | OHLC, not declared | — | — | — |  |
| Realized volatility | `statistics.pro.volatility.RealizedVolatilityRTIndicator` |  | — | — | — |  |
| Rogers-Satchell volatility | `statistics.pro.volatility.RogersSatchellVolatilityRTIndicator` | OHLC, not declared | — | — | — |  |
| Yang-Zhang volatility | `statistics.pro.volatility.YangZhangVolatilityRTIndicator` | OHLC, not declared | — | — | — |  |

### Statistics: ratios

| Indicator | Java class | Bars | TS class | TS builder | `Pro.on` | Notes |
|---|---|---|---|---|---|---|
| Calmar Ratio | `statistics.pro.ratios.CalmarRatioRTIndicator` |  | — | — | — |  |
| Information Ratio | `statistics.pro.ratios.InformationRatioRTIndicator` |  | — | — | — |  |
| Max Drawdown | `statistics.pro.ratios.MaxDrawdownRTIndicator` |  | — | — | — |  |
| Omega Ratio | `statistics.pro.ratios.OmegaRatioRTIndicator` |  | — | — | — |  |
| Sharpe Ratio | `statistics.pro.ratios.SharpeRatioRTIndicator` |  | — | — | — |  |
| Sortino Ratio | `statistics.pro.ratios.SortinoRatioRTIndicator` |  | — | — | — |  |
| Tail Ratio | `statistics.pro.ratios.TailRatioRTIndicator` |  | — | — | — |  |
| Treynor Ratio | `statistics.pro.ratios.TreynorRatioRTIndicator` |  | — | — | — |  |
| Ulcer Index | `statistics.pro.ratios.UlcerIndexRTIndicator` |  | — | — | — |  |
