---
code: true
type: page
title: once
description: BackendCluster.once method
---

# `once()`

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Listens to event emitted with [BackendCluster.broadcast](/core/2/framework/classes/backend-cluster/broadcast).

The registered listener will be called exactly once, after which it will be removed from the listeners list.

```ts
once (event: string, listener: Function): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>Function</pre> | Listener function. Called exactly once. |

## Usage

```js
app.cluster.once('some:event', payload => {
  // ...listener code...
})
```
