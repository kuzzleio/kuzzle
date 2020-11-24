---
code: true
type: page
title: use
description: BackendLogger.verbose method
---

# `verbose()`

Logs a verbose message.

::: info
This method can only be used after application startup.
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
