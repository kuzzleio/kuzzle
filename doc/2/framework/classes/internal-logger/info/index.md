---
code: true
type: page
title: info
description: InternalLogger.info method
---

# `info()`

Logs an info message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
info(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

## Usage

```js
app.log.info('Something is happening')
```
