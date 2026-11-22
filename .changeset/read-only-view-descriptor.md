---
"@qtsurfer/indicators": patch
---

A read-only view describes the indicator it wraps: the function form of `withMeta` reaches the wrapped indicator, like the key form and `withDisplayHint` already did. `hide()` on a view marks the view only, never the indicator it wraps, and the view reads as hidden. A view registered under an internal name (`_...`) is registered as a view of its own, so hiding that alias no longer hides the same view when it is held by another entry or handed out again by `getReadOnly`.
