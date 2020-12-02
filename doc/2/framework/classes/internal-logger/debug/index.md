---
code: true
type: page
title: debug
description: InternalLogger.debug method
---

# `debug()`

Logs a debug message.

::: info
This method can only be used after the application started up.
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
