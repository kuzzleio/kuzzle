---
code: true
type: page
title: once
description: BackendCluster.once method
---

# `once()`

<SinceBadge version="2.9.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Listens to an event emitted with [BackendCluster.broadcast](/core/2/framework/classes/backend-cluster/broadcast).

The registered listener will be called exactly once, after which it will be removed from the listeners list.

```ts
once (event: string, listener: EventHandler): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>[EventHandler](/core/2/framework/types/event-handler)</pre> | Listener function. Called exactly once. |

## Usage

```js
app.cluster.once('some:event', payload => {
  // ...listener code...
})
```
