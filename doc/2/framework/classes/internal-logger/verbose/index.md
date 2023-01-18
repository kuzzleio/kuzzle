---
code: true
type: page
title: verbose | Framework | Core

description: InternalLogger.verbose method
---

# `verbose()`

Logs a verbose message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
verbose(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

## Usage

```js
app.log.verbose('Something is happening')
```
