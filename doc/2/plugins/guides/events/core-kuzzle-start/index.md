---
code: true
type: page
title: core:kuzzleStart
---

# core:kuzzleStart

<DeprecatedBadge version="2.2.0" />

This event is deprecated, and may be removed in a future version of Kuzzle.
Use [kuzzle:state:ready](/core/2/plugins/guides/events/kuzzle-state) instead.

Triggered when Kuzzle has finished booting and is ready to process user requests.

:::info
Pipes cannot listen to that event, only hooks can.
:::
