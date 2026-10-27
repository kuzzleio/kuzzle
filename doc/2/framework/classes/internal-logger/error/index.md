---
code: true
type: page
title: use | Framework | Core

description: InternalLogger.error method
---

# `error()`

<DeprecatedBadge version="2.60.0" />

Logs an error message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
error(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |

## Usage

```js
app.log.error('Something is happening')
```
