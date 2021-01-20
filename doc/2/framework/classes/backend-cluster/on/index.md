---
code: true
type: page
title: on
description: BackendCluster.on method
---

# `on()`

<SinceBadge version="2.9.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Listens to event emitted with [BackendCluster.broadcast](/core/2/framework/classes/backend-cluster/broadcast).

```ts
on (event: string, listener: EventHandler): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>[EventHandler](/core/2/framework/types/event-handler)</pre> | Listener function. Called as many times as the listened event is received. |

## Usage

```js
app.cluster.on('some:event', payload => {
  // ...listener code...
})
```
