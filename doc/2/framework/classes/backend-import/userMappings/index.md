---
code: true
type: page
title: userMappings
description: BackendImport.userMappings method
---

# `userMappings()`

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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
