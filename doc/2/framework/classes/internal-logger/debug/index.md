---
code: true
type: page
title: debug | Framework | Core

description: InternalLogger.debug method
---

# `debug()`

<DeprecatedBadge version="2.60.0" />

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
