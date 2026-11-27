---
"@qtsurfer/strategy": minor
---

A backtest applies the detach a strategy asks for. `detach(instrument)` and `detach(context)` emit a `DETACH` system signal that `BacktestRunner` used to ignore, so the strategy went on receiving every data point. From the next data point a detached instrument is read by nobody: neither the strategy nor the simulated venue, so its pending orders and stops stay as they are, and `totalTicks` does not count it. The other instruments go on. When the strategy detaches the attachment of the run (`"backtest"`) or every instrument of the data, the run ends there and `onDetach` is called once with the reason `STRATEGY` instead of `OWNER`; a detach from `onAttach` reads nothing. `onDetach` runs with `setSourceDetaching(true)`, so a `detach(...)` inside it emits nothing. The metrics and the equity curve still span the whole data, whether or not the run was cut short. A strategy that never detaches runs as before. This mirrors the Java engine.
