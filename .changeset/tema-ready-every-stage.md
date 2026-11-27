---
"@qtsurfer/indicators": minor
---

`tema` says it is ready when each of its three averages has its values: at update `3 * (periods - 1) + 1` (`tema(14)` at update 40), where it said so at update `periods`. The values do not change at any update, only the update from which the indicator is ready, and the updates that count are the finite ones. `tema` also ignores a price that is not finite (NaN or an infinity), as `ema` and the indicators built on it do: it returns the previous value and updates no average. Before, a first update of NaN started the second and third averages from 0 (`tema(3)` over closes near 100 read 175 instead of 100), and one in the middle fed them the same tick twice. With finite prices nothing changes. These mirror the Java engine.
