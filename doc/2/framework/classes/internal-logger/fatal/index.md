---
code: true
type: page
title: fatal | Framework | Core

description: InternalLogger.fatal method
---

# `fatal()`

<SinceBadge version="2.43.0" />
<DeprecatedBadge version="2.60.0" />

Logs a fatal message.

::: info
Before application startup this method will use `console.log` instead of the configured logger.
:::

```ts
fatal(message: any): void
```

<br/>

| Argument  | Type           | Description    |
|-----------|----------------|----------------|
| `message` | <pre>any</pre> | Message to log |
