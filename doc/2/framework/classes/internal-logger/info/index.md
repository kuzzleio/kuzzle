---
code: true
type: page
title: info | Framework | Core

description: InternalLogger.info method
---

# `info()`

<DeprecatedBadge version="2.60.0" />

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
