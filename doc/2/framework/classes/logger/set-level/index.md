---
code: true
type: page
title: setLevel | Framework | Core
description: Logger.setLevel method
---

# `setLevel()`

Changes the log level at runtime. Same as setting the [level](/core/2/framework/classes/logger/properties#level) property.

```ts
setLevel(level: string): void
```

<br/>

| Argument | Type              | Description                                                    |
|----------|-------------------|----------------------------------------------------------------|
| `level`  | <pre>string</pre> | `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent` |

## Usage

```js
app.log.setLevel('debug');
```
