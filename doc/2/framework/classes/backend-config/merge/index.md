---
code: true
type: page
title: merge | Framework | Core

description: BackendConfig.merge method
---

# `merge()`

<DeprecatedBadge version="2.17.0"/>

Merges a configuration object into the current configuration.

::: info
This method can only be used before the application is started.
:::

```ts
merge(config: KuzzleConfigurationOverrides): void
```

<br/>

| Argument | Type                                                                                       | Description                   |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| `config` | <pre>[KuzzleConfigurationOverrides](/core/2/framework/types/kuzzle-configuration)</pre> | Configuration object to merge |

## Usage

```js
app.config.merge({
  limits: {
    documentsWriteCount: 1000
  }
})
```
