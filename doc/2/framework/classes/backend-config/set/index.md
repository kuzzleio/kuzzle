---
code: true
type: page
title: set
description: BackendConfig.set method
---

# `set()`

<SinceBadge version="2.8.0" />

Sets a configuration value.

::: info
This method can only be used before the application is started.
:::

```ts
set(path: string, value: any): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `path` | <pre>string</pre> | Path to the configuration key (lodash style) |
| `value` | <pre>any</pre> | Value for the configuration key |

## Usage

```js
app.config.set('limits.documentsWriteCount', 1000)
```
