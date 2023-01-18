---
code: true
type: page
title: removeAllListeners | Framework | Core

description: BackendCluster.removeAllListeners method
---

# `removeAllListeners()`

<SinceBadge version="2.9.0" />

Unregisters all listeners from an event.

```ts
removeAllListeners (event: string): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |

## Usage

```js
app.cluster.removeAllListeners('some:event');
```
