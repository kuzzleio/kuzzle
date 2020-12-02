---
code: true
type: page
title: warn
description: InternalLogger.warn method
---

# `warn()`

Logs a info message.

::: info
This method can only be used after the application started up.
:::

```ts
warn(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

## Usage

```js
app.log.warn('Something is happening')
```
