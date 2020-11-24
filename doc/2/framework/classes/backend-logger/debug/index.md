---
code: true
type: page
title: use
description: BackendLogger.debug method
---

# `debug()`

Logs a debug message.

::: info
This method can only be used after application startup.
:::

```ts
debug(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

**Usage:**

```js
app.log.debug('Something is happening')
```
