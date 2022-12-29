---
code: true
type: page
title: merge | Framework | Core

description: BackendConfig.merge method
---

# `merge()`

<DeprecatedBadge version="2.17.0"/>

Sets a configuration value.

::: info
This method can only be used before the application is started.
:::

```ts
merge(config: JSONObject): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `config` | <pre>JSONObject</pre> | Configuration object to merge |

## Usage

```js
app.config.merge({
  limits: {
    documentsWriteCount: 1000
  }
})
```
