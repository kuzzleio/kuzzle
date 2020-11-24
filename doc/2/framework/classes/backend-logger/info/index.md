---
code: true
type: page
title: use
description: BackendLogger.info method
---

# `info()`

Logs an info message.

::: info
This method can only be used after application startup.
:::

```ts
info(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

**Usage:**

```js
app.log.info('Something is happening')
```
