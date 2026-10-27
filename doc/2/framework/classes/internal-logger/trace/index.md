---
code: true
type: page
title: trace | Framework | Core

description: InternalLogger.trace method
---

# `trace()`

<SinceBadge version="2.43.0" />

Logs a trace message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
trace(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |
