---
code: true
type: page
title: verbose
description: BackendLogger.verbose method
---

# `verbose()`

Logs a verbose message.

::: info
This method can only be used after the application started up.
:::

```ts
verbose(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

**Usage:**

```js
app.log.verbose('Something is happening')
```
