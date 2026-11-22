---
"@qtsurfer/strategy": minor
---

A strategy has a global state store. `getGlobalStateStore()` returns the store of the strategy as a whole, created on first use and the same object on every call. It is a namespace of its own: a key written in it is never seen through an instrument's store (`getStateStore(instrument)`, which is unchanged), and the other way round. The windows of an instrument still use that instrument's store.
