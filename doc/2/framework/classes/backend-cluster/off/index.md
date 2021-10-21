---
code: true
type: page
title: off
description: BackendCluster.off method
---

# `off()`

<SinceBadge version="2.9.0" />

Unregisters a listener.

If multiple instances of the same listener are registered, only the first one is removed.

```ts
off (event: string, listener: EventHandler): Promise<void>
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `listener` | <pre>[EventHandler](/core/2/framework/types/event-handler)</pre> | Listener function to remove. |

## Usage

```js
function listener (payload) {
  // ... listener code ...
}

app.cluster.on('some:event', listener);

app.cluster.off('some:event', listener);
```
