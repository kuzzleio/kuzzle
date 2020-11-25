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
as (user: { _id: string }): EmbeddedSDK;
```

<br/>

| Argument  | Type   | Description            |
| -------------- | --------- | ------------- |
| `user` | <pre>{ _id: string }</pre> | User object with at least the `_id` property    |

## Returns

Returns a new instance of the EmbeddedSDK.

## Usage

```ts
await app.sdk.as(request.context.user).auth.getCurrentUser();
```
