---
code: true
type: page
title: silly | Framework | Core
description: Logger.silly method
---

# `silly()`

<DeprecatedBadge version="2.45.0" />

**Use [trace](/core/2/framework/classes/logger/trace) instead.**

Logs a message with the `trace` level. The first call also logs a deprecation warning.

```ts
silly(message: string): void
```

<br/>

| Argument  | Type              | Description    |
|-----------|-------------------|----------------|
| `message` | <pre>string</pre> | Message to log |

::: warning
This method only exists on `app.log`. Child loggers created with [child](/core/2/framework/classes/logger/child), including [PluginContext.logger](/core/2/framework/classes/plugin-context/properties#logger), do not have it.
:::
