---
code: true
type: page
title: kuzzle:start
---

# kuzzle:start

<DeprecatedBadge version="2.3.0" />

This event is deprecated, and may be removed in a future version of Kuzzle.
Use [kuzzle:state:ready](/core/2/plugins/guides/events/kuzzle-state) instead.

Triggered when Kuzzle has finished its startup sequence, and is about to accept network connections.

Kuzzle will wait for pipe listeners to return before accepting user requests.
