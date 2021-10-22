---
code: true
type: page
title: profiles
description: BackendImport.profiles method
---

# `profiles()`

<SinceBadge version="2.14.0" />

Loads profiles into the app.

This method is idempotent. If a profile is defined multiple times, only the last definition will be retained.

::: info
This method can only be used before the application is started.
:::

```ts
profiles(profiles: JSONObject): void
```

<br/>

| Argument   | Type                  | Description                   |
|------------|-----------------------|-------------------------------|
| `profiles` | <pre>JSONObject</pre> | Object containing profiles and their [definitions](/core/2/guides/main-concepts/permissions#profiles). |

## Usage

```js
app.import.profiles({
  profileA: {
    rateLimit: 50,
    policies: [
      {
        roleId: 'roleA'
      },
      {
        roleId: 'roleB',
        restrictedTo: [
          {
            index: 'index1'
          },
          {
            index: 'index2',
            collections: [ 'collectionA', 'collectionB']
          }
        ]
      }
    ]
  },
  profileB: {
    policies: [
      { roleId: 'roleA' }
    ]
  },
})
```
