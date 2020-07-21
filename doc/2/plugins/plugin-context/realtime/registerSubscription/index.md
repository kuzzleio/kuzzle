---
code: true
type: page
title: registerSubscription
---

# registerSubscription

Subscribes to a given collection and a given set of filters, exactly like the [`realtime:subscribe` API endpoint](/api/controllers/realtime/subscribe/index.md) except that this method accepts a `connectionId` parameter that specifies the connection ID to route the notifications to.

## Arguments

```js
registerSubscription(connectionId, index, collection, filters, [object])
```

<br/>

| Argument | Type | Description |
|----------|------|-------------|
| `connectionId` | `String` | The connection ID to route the subscription notifications to |
| `index` | `String` | The index containing the collection to subscribe to |
| `collection` | `String` | The collection to subscribe to |
| `filters` | `Object` | The subscription filters, expressed in [Koncorde]() syntax |
| `options` | `Object` | The options to pass to the subscription |


The most common use-case of this method is to restrict the realtime subscriptions from the server. Instead of leaving the client-side with the freedom of specifying any filter for a given connection, you can open a custom API endpoint in your plugin and call `registerSubscription` inside it by passing the same connection ID of the incoming Request. When the client hits this endpoint, they will start receiving the notifications from the subscription that has been shaped on server-side.

::: info
Note that the same result can be achieved by adding a pipe on the `realtime:subscribe` API endpoint. The pipe would check the filters object and make the request fail if the filters are not allowed. This approach has two main downsides:
* you always need to be extremely careful when adding code to pipes that may result in failing requests, that's why code in pipes should always stay as light as possible;
* even if you are ensuring security through the pipe, you still have to specify the filters in the client code, which is something you may not want to do.
:::

