---
code: true
type: page
title: verbose | Framework | Core
description: Logger.verbose method
---

# `verbose()`

<DeprecatedBadge version="2.45.0" />

**Use [debug](/core/2/framework/classes/logger/debug) instead.**

Logs a message with the `debug` level. The first call also logs a deprecation warning.

```ts
verbose(message: string): void
```

<br/>

| Argument  | Type              | Description    |
|-----------|-------------------|----------------|
| `message` | <pre>string</pre> | Message to log |

::: warning
This method only exists on `app.log`. Child loggers created with [child](/core/2/framework/classes/logger/child), including [PluginContext.logger](/core/2/framework/classes/plugin-context/properties#logger), do not have it.
:::
