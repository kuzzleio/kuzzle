---
code: true
type: page
title: removeAllListeners
description: BackendCluster.removeAllListeners method
---

# `removeAllListeners()`

<SinceBadge version="2.9.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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
