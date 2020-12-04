---
type: page
code: false
title: Auth
description: Auth events list
order: 100
---

# Auth Events

## auth:strategyAuthenticated

| Arguments  | Type              | Description                                                                                                            |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `strategy` | <pre>string</pre> | [Authentication strategy](/core/2/guides/main-concepts/authentication#authentication-strategies) name |
| `user`     | <pre>object</pre> | Authenticated user properties                                                                                          |

This event is triggered after a successful user authentication, but before a token is generated.

It is also triggered before the [auth:afterLogin](/core/2/framework/events/api#after) event.

---

### user

The provided `user` object has the following properties:

| Properties   | Type                | Description                                                                                     |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| `_id`        | <pre>string</pre>   | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) |
| `profileIds` | <pre>string[]</pre> | List of associated profiles                                                                     |
