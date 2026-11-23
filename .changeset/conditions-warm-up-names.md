---
"@qtsurfer/indicators": minor
---

Conditions, a stricter `distanceMa`, a name of its own for `percentChange`, and warm-up rules that keep a warming-up source out of what is built on it. These mirror the Java engine.

**Conditions.** The group has `isEqual`, `isNotEqual`, `isGreatThan`, `isGreatOrEqual`, `isLessThan`, `isLessOrEqual` (name, indicator, coefficient) and `isTrue` (name, indicator, predicate). Each registers a new `ConditionRTIndicator`, which reads `1` while the condition holds and `0` while it does not, is ready when its source is, and carries the id `condition`, the source, the range `0:1` and the `N` display hint. `group.isValue(name)` reads any indicator as a flag: `true` when it is ready and its value is neither zero nor NaN, `false` while it warms up, and it throws for a name that is not registered. `equal`, `notEqual`, `greatThan`, `greatOrEqual`, `lessThan` and `lessOrEqual` stay what they were: filters that hold the last value that passed.

**`distanceMa` accepts any moving average, and only those.** `sma`, `ema`, `mma`, `wma`, `wmaIncremental`, `hma`, `tema` and `kama` are accepted, found by their id, so a read-only view of one passes too. Any other indicator throws `Not a moving average indicator: <id>`, where before anything was accepted.

**Names.** `percentChange(x)` registers as `pchg<x>` (new constant `PREFIX_PERCENT_CHANGE`) and `rateChange(x)` keeps `chg<x>`. A strategy that read the percent change under `chg<x>` reads it under `pchg<x>` now. The two builders no longer replace each other. Registering a name that is already used by a different indicator writes a warning to the console (`The name 'n' now reads a different indicator: A replaced B`); the last registration still wins.

**`min`, `max` and `sum` of an indicator** take its values only from the update where it is ready, and hold `0` and report not ready until then. Before, the values of a source that was still warming up (an RSI starts at 0) went in and stayed: a minimum stuck at 0 for the whole run.

**Warm-up of chained smoothing.** An average or a window is fed only once its source is valid. `hma(n)` is ready at update `n + round(sqrt n) - 1` (19 for 16) and reads the unsmoothed difference before that; `stochRsi(n)` is ready at `2n - 1` (27 for 14), or one window after its RSI when it reads another indicator. Values from the ready update on do not change.
