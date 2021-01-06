---
code: true
type: page
title: warn
description: InternalLogger.warn method
---

# `warn()`

Logs a info message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
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
