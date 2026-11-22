---
"@qtsurfer/indicators": minor
---

The free indicators of the builder describe how a chart should draw them, with the same keys as the Java engine. `IndicatorMeta` gains placement (`plc`, drawn over the price), range (`rng`), floor (`flo`), levels (`lvl`), plot style (`sty`), side (`sde`) and drawn-by-default (`drw`), with typed accessors (`isOverlay`, `getRange`, `getFloor`, `getLevels`, `getPlotStyle`, `getPlotSide`, `isDrawnByDefault` and their setters), and constants for the keys of the parameters (`IndicatorMeta.PERIODS`, `K`, `BAND`, `OUTPUT`...). `PlotStyle` and `PlotSide` are new, `DisplayHint` gains `FRACTION` (`F`), `RATIO` (`R`), `INDEX` (`I`) and `NUMBER` (`N`), and `withMeta` accepts a function that edits the metadata.

Averages (`sma`, `ema`, `wma`, `tema`, `hma`, `mma`, `kama`) and the Bollinger bands are drawn over the price; `cci` and `macd` carry a zero line; `rsi` and `stochRsi` have a 0 to 100 scale; `cci` and `variance` read as pure numbers, `bollingerPercentB` as a ratio, `volatility` and `percentVolatility` as percentages. An average or MACD of another indicator keeps no placement, and a MACD keeps its zero line. No value changes; the unit of `rsi` and `stochRsi` stays a percentage.
