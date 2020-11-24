---
type: page
code: false
title: Kuzzle
description: Kuzzle events list
order: 100
---

# Kuzzle Events

## kuzzle:shutdown

Triggered when the current node starts a graceful shutdown.  
All new API requests are rejected, and the node halts once all pending requests have been played.

:::info
Pipes cannot listen to that event, only hooks can.
:::

## kuzzle:start

<DeprecatedBadge version="2.3.0" />

This event is deprecated, and may be removed in a future version of Kuzzle.
Use [kuzzle:state:ready](/core/2/plugins/guides/events/kuzzle-state) instead.

Triggered when Kuzzle has finished its startup sequence, and is about to accept network connections.

Kuzzle will wait for pipe listeners to return before accepting user requests.

## kuzzle:state:start

<SinceBadge version="2.3.0" />

This event is triggered when Kuzzle begins its startup sequence.

## kuzzle:state:live

<SinceBadge version="2.3.0" />

This event is triggered when Kuzzle has loaded every internal components but is not yet accepting user requests.

<SinceBadge version="2.3.0" />

## kuzzle:state:ready

This event is triggered when Kuzzle is ready to accept incoming requests.
