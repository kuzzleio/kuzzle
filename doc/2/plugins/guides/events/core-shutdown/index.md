---
code: true
type: page
title: core:shutdown
---

# core:shutdown

Triggered when the current node starts a graceful shutdown.  
All new API requests are rejected, and the node halts once all pending requests have been played.

:::info
Pipes cannot listen to that event, only hooks can.
:::
