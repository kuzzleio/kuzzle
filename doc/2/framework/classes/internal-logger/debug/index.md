---
code: true
type: page
title: debug
description: InternalLogger.debug method
---

# `debug()`

Logs a debug message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
debug(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

## Usage

```js
app.log.debug('Something is happening')
```
