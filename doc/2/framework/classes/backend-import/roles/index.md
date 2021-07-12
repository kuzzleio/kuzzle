---
code: true
type: page
title: roles
description: BackendImport.roles method
---

# `roles()`

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Loads roles into the app.

This method is idempotent. If a role is defined multiple times, only the last definition will be retained.

::: info
This method can only be used before the application is started.
:::

```ts
roles(roles: JSONObject): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `roles`  | <pre>JSONObject</pre> | Object containing roles and their [definitions](/core/2/guides/main-concepts/permissions#roles). |

## Usage

```js
app.import.roles({
  roleA: { /* role definition */ },
  roleB: { /* role definition */ },
})
```
