---
code: true
type: page
title: userMappings
description: BackendImport.userMappings method
---

# `userMappings()`

<SinceBadge version="2.14.0" />

Loads user mappings into the app.

This method is idempotent. If mappings are defined multiple times, only their last definition will be retained.

::: info
This method can only be used before the application is started.
:::

```ts
userMappings(mappings: JSONObject): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `mappings`  | <pre>JSONObject</pre> | [User mappings](/core/2/guides/main-concepts/permissions#users). |

## Usage

```js
app.import.userMappings({
  properties: {
    fieldA: { type: 'keyword' },
    fieldB: { type: 'integer' }
  }
})
```
