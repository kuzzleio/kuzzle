---
code: true
type: page
title: remove | Framework | Core

description: BackendSubscription.remove method
---

# `remove()`

<SinceBadge version="2.22.0" />

Removes a realtime subscription on the specified connection.

This method is a backend version of the [realtime:unsubscribe](/core/2/api/controllers/realtime/unsubscribe) API action.

::: info
This method can only be used before the application is started.
:::

```ts
remove(
  connection: Connection,
  roomId: string,
): Promise<void>
```

<br/>

| Argument     | Type                 | Description                                |
| ------------ | -------------------- | ------------------------------------------ |
| `connection` | <pre>Connection<pre> | Connection to remove the subscription from |
| `roomId`     | <pre>string</pre>    | Room identifier                            |

## Usage

```js
await app.subscription.remove(
  request.context.connection,
  "<unique Kuzzle room identifier>"
);
```
