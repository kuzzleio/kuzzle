---
code: true
type: page
title: info
description: BackendLogger.info method
---

# `info()`

Logs an info message.

::: info
This method can only be used after the application started up.
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
