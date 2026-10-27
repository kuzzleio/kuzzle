---
code: true
type: page
title: as | Framework | Core

description: EmbeddedSDK class as() method
---

# as

Returns a new EmbeddedSDK instance impersonating the provided user.

## Arguments

```ts
as (user: { _id: string }, options = { checkRights: false }): EmbeddedSDK;
```

<br/>

| Argument  | Type                        | Description                                              |
| --------- | --------------------------- | -------------------------------------------------------- |
| `user`    | <pre>{ \_id: string }</pre> | User object with at least the `_id` property             |
| `options` | <pre>object</pre>           | Optional object with the `checkRights` property (default: `{ checkRights: false }`) |

**options:**

<SinceBadge version="2.10.0" />

| Property      | Type (default)     | Description                                                                              |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `checkRights` | <pre>boolean</pre><br/>(`false`) | If true, will check if the impersonated user is allowed to execute any following actions |

## Returns

Returns a new impersonated EmbeddedSDK instance.

Throws a `plugin.context.invalid_user` error if `user` is not an object with a string `_id` property.

::: info
The impersonated SDK sends its requests through the [query](/core/2/framework/classes/embedded-sdk/query) method of the EmbeddedSDK: the same `auth` actions are refused.
:::

## Usage

```ts
await app.sdk.as(request.context.user, { checkRights: true }).document.create(
  'nyc-open-data',
  'yellow-taxi',
  { name: 'Aschen' });
```
