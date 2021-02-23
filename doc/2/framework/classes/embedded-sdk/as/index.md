---
code: true
type: page
title: as
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
| `options` | <pre>object</pre>           | Optional object with at least the `checkRights` property |

**options:**

<SinceBadge version="auto-version" />

| Property      | Type (default)     | Description                                                                              |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `checkRights` | <pre>boolean</pre> | If true, will check if the impersonated user is allowed to execute any following actions |

## Returns

Returns a new impersonated EmbeddedSDK instance.

## Usage

```ts
await app.sdk.as(request.context.user).auth.getCurrentUser();
```
