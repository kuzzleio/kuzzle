---
type: page
code: false
title: Kuzzle | Framework | Core

description: Kuzzle events list
order: 100
---

# Kuzzle Events

## kuzzle:shutdown

Triggered when the current node starts a graceful shutdown.  
All new API requests are rejected, and the node halts once all pending requests have been played.

The node waits for pipe listeners to return before going on with its shutdown.

## kuzzle:start

<DeprecatedBadge version="2.3.0" />

This event is deprecated, and may be removed in a future version of Kuzzle.
Use [kuzzle:state:ready](/core/2/framework/events/kuzzle#kuzzle-state-ready) instead.

Triggered when Kuzzle has finished its startup sequence, and is about to accept network connections.

Kuzzle will wait for pipe listeners to return before accepting user requests.

## kuzzle:state:change

<SinceBadge version="2.11.0" />

| Arguments | Type              | Description           |
| --------- | ----------------- | --------------------- |
| `state`   | <pre>number</pre> | New state of the node |

Triggered when the cluster changes the state of the node, once it is started:

- `4` (not enough nodes): the number of active cluster nodes went below the [cluster.minimumNodes](/core/2/guides/advanced/configuration) setting. The node rejects API requests until enough nodes are back.
- `2` (running): enough nodes are active again, and the node accepts API requests again.

:::info
Pipes cannot listen to that event, only hooks can.
:::

## kuzzle:state:start

<SinceBadge version="2.3.0" />

This event is triggered when Kuzzle begins its startup sequence.

::: warning
This event is triggered before applications and plugins register their pipes and hooks: none of their handlers receive it.
:::

## kuzzle:state:live

<SinceBadge version="2.3.0" />

This event is triggered when Kuzzle has loaded all its internal components but is not yet accepting user requests.

## kuzzle:state:ready

<SinceBadge version="2.3.0" />

This event is triggered when Kuzzle is ready to accept incoming requests.
