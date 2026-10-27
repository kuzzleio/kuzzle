---
code: true
type: page
title: level | Framework | Core

description: InternalLogger.level method
---

# `level()`

<SinceBadge version="2.43.0" />
<DeprecatedBadge version="2.60.0" />

Changes the log level of the Kuzzle logger at runtime.

::: info
This method only works once the application is started. Before that, it prints a message with `console.log` and does nothing.
:::

```ts
level(level: string): void
```

<br/>

| Argument | Type              | Description                                                             |
|----------|-------------------|-------------------------------------------------------------------------|
| `level`  | <pre>string</pre> | New log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent` |
