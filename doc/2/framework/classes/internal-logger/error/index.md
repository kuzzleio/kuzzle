---
code: true
type: page
title: use
description: InternalLogger.error method
---

# `error()`

Logs an error message.

::: info
This method can only be used after the application started up.
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
