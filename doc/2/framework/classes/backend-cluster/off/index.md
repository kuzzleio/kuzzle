---
code: true
type: page
title: off
description: BackendCluster.off method
---

# `off()`

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Unregisters a listener.

If multiple instances of the same listener are registered, only the first one is removed.

```ts
off (event: string, listener: Function): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>Function</pre> | Listener function to remove. |

## Usage

```js
function listener (payload) {
  // ... listener code ...
}

app.cluster.on('some:event', listener);

app.cluster.off('some:event', listener);
```
