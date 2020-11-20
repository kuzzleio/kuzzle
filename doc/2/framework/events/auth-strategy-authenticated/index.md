---
code: true
type: page
title: auth:strategyAuthenticated
---

# auth:strategyAuthenticated



| Arguments  | Type              | Description                                                                                                            |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `strategy` | <pre>string</pre> | [Authentication strategy](/core/2/guides/essentials/user-authentication#authentication-strategies) name |
| `user`     | <pre>object</pre> | Authenticated user properties                                                                                          |

This event is triggered after a successful user authentication, but before a token is generated.

It is also triggered before the [auth:afterLogin](/core/2/plugins/guides/events/api-events#after) event.

---

## user

The provided `user` object has the following properties:

| Properties   | Type                | Description                                                                                     |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| `_id`        | <pre>string</pre>   | User's [kuid](/core/2/guides/essentials/user-authentication#kuzzle-user-identifier-kuid) |
| `profileIds` | <pre>string[]</pre> | List of associated profiles                                                                     |
