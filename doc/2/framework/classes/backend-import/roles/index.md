---
code: true
type: page
title: roles | Framework | Core

description: BackendImport.roles method
---

# `roles()`

<SinceBadge version="2.14.0" />

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
  roleA: {
    controllers: {
      controllerA: {
        actions: {
          actionA: true,
          actionB: false,
        }
      },
      controllerB: {
        actions: {
          '*': true
        }
      },
    }
  },
  roleB: {
    controllers: {
      '*': {
        actions: {
          '*': true
        }
      }
    },
  },
})
```
