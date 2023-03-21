---
code: true
type: page
title: add | Framework | Core

description: BackendSubscription.add method
---

# `add()`

<SinceBadge version="auto-version" />

Registers a new realtime subscription on the specified connection.

This method is a backend version of the [realtime:subscribe](/core/2/api/controllers/realtime/subscribe) API action.

This connection will then starts to receive realtime messages on the returned `roomId`.

::: info
This method can only be used before the application is started.
:::

```ts
add(
  connection: Connection,
  index: string,
  collection: string,
  filters: JSONObject,
  {
    volatile,
    scope,
    users,
  }: {
    volatile?: JSONObject;
    scope?: "in" | "out" | "all" | "none";
    users?: "in" | "out" | "all" | "none";
  }
): Promise<{ roomId: string; channel: string }>
```

<br/>

| Argument     | Type                  | Description                                            |
| ------------ | --------------------- | ------------------------------------------------------ |
| `connection` | <pre>Connection<pre>  | Connection to register the subscription on             |
| `index`      | <pre>string</pre>     | Index name                                             |
| `collection` | <pre>string</pre>     | Collection name                                        |
| `filters`    | <pre>JSONObject</pre> | Subscription filters                                   |
| `options`    | <pre>JSONObject</pre> | Subscription options (`volatile`, `scope` and `users`) |

## Usage

```js
const { roomId, channel } = await app.subscription.add(
  request.context.connection,
  "lamaral",
  "windsurf",
  {
    range: { wind: { gte: 20 } },
  },
  {
    users: "all",
    scope: "in",
    volatile: { name: "Aschen" },
  }
);
```
