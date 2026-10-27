---
type: page
code: false
title: Auth | Framework | Core

description: Auth events list
order: 100
---

# Auth Events

## auth:strategyAuthenticated

| Arguments | Type              | Description                                    |
| --------- | ----------------- | ---------------------------------------------- |
| `payload` | <pre>object</pre> | Strategy name and authenticated user, see below |

This event is triggered after a successful user authentication, but before a token is generated.

It is also triggered before the [auth:afterLogin](/core/2/framework/events/api#after) event.

Pipes listening to this event receive a single object, and must resolve to an object of the same shape.

::: info
This event is not triggered for the intermediate steps of a multi-step authentication strategy (for instance, the first redirection call of an OAuth strategy), where the strategy does not return a user.
:::

---

### payload

The provided `payload` object has the following properties:

| Properties | Type              | Description                                                                                   |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `strategy` | <pre>string</pre> | [Authentication strategy](/core/2/guides/write-plugins/integrate-authentication-strategy) name |
| `content`  | <pre>User</pre>   | Authenticated user                                                                            |

The `content` user object has, among others, the following properties:

| Properties   | Type                | Description                                                                            |
| ------------ | ------------------- | -------------------------------------------------------------------------------------- |
| `_id`        | <pre>string</pre>   | User's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) |
| `profileIds` | <pre>string[]</pre> | List of associated profiles                                                            |
