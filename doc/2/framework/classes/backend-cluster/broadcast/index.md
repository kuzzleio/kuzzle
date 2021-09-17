---
code: true
type: page
title: broadcast
description: BackendCluster.broadcast method
---

# `broadcast()`

<SinceBadge version="2.9.0" />

Broadcasts an event and its payload to other cluster nodes.

This function returns once the event has been emitted.

```ts
broadcast (event: string, payload: JSONObject): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `payload` | <pre>JSONObject</pre> | Event payload |

## Usage

```js
await app.cluster.broadcast('some:event', { payload: 'information' })
```
