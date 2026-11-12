---
"@qtsurfer/indicators": minor
---

`stochRsi(periods)` and `stochRsi(name, periods)` on the group builder now use Wilder's RSI averages, as their name says.
The previous default, discrete simple averages, held each RSI value for a whole block of `periods` updates, so the
stochastic collapsed to 0 and 100 on real series. Behaviour change for strategies that use `stochRsi` without the new flag.
Two overloads, `stochRsi(periods, sma)` and `stochRsi(name, periods, sma)`, pick the averages explicitly: `true` gives the
previous behaviour. The `StochasticRsiRTIndicator` constructors are unchanged.
