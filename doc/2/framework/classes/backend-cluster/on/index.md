---
code: true
type: page
title: on
description: BackendCluster.on method
---

# `on()`

<SinceBadge version="2.9.0" />

Listens to event emitted with [BackendCluster.broadcast](/core/2/framework/classes/backend-cluster/broadcast).

```ts
on (event: string, listener: ClusterEventHandler): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>[ClusterEventHandler](/core/2/framework/types/event-handler)</pre> | Listener function. Called as many times as the listened event is received. |

## Usage

```js
app.cluster.on('some:event', payload => {
  // ...listener code...
})
```
