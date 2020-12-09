---
code: true
type: page
title: merge
description: BackendConfig.merge method
---

# `merge()`

<SinceBadge version="2.8.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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
