---
code: true
type: page
title: users
description: BackendImport.users method
---

# `users()`

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Loads users into the app.

This method is idempotent. If a user is defined multiple times before the app starts with the same kuid, only the last one will be retained.

::: info
This method can only be used before the application is started.
:::

```ts
users(
  users: JSONObject,
  options?: {
    onExistingUsers?: 'overwrite' | 'skip'
  }
): void
```

<br/>

| Argument          | Type                                     | Description                   |
|-------------------|------------------------------------------|-------------------------------|
| `users`           | <pre>JSONObject</pre>                    | Object containing users and their [definitions](/core/2/guides/main-concepts/permissions#users). |
| `onExistingUsers` | <pre>[`overwrite`, `skip`]</pre>         | Default to `skip`. Strategy to adopt when trying to import an already existing user.

::: warning
`onExistingUsers` option applies globally for every user import even when not given in this specific call.
:::

## Usage

```js
app.import.users({
  kuidA: {
    content: {
      profileIds: ['profileA', 'profileB'],
      name: 'foo'
    },
    credentials: {
      local: { username: 'bar', password: 'foobar' }
    }
  },
  kuidB: {
    content: {
      profileIds: ['profileA'],
      name: 'bar'
    },
    credentials: {
      local: { username: 'foo', password: 'barfoo' }
    }
  },
})
```
