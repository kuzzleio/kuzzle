---
code: true
type: page
title: registerSubscription
---

# `realtime`

Adds or removes [real-time subscriptions](/core/2/guides/essentials/real-time) from the backend.

## `subscribe`

Registers a new realtime subscription on behalf of a client. The subscription works exactly like the one created by the [`realtime:subscribe` API endpoint](/api/controllers/realtime/subscribe/index.md). The notifications will be sent to the connection identified by the `Request` object passed to the method.

---

### Arguments

```js
subscribe(request)
```

<br/>

| Argument | Type | Description |
|----------|------|-------------|
| `request` | `Request` | The request object that contains the subscription payload |

---

### Return

Resolves to the room ID associated with the registered subscription.

---

### Example

```js
async subscribeToSomething(request) {
  const customRequest = new Request(
    {
      action: request.input.action,
      body: {
        equals: {
          myAttribute: 'mycollection'
        }
      },
      collection: 'yellow-taxi',
      controller: request.input.controller,
      index: 'myindex',
    },
    {
      connectionId: request.context.connection.id,
    });

  const options = {}
  const roomId = await this.context.accessors.realtime.subscribe(customRequest);
  return { roomId }
}
```

---

### Use cases

The most common use-case of this method is to implement the realtime subscriptions on the server-side. Instead of leaving the client-side with the freedom (and the responsibility) of specifying the filters for a subscription, you can open a custom API endpoint in your plugin and call `accessors.realtime.subscribe` inside it by passing the incoming Request. When the client hits this endpoint, they will start receiving the notifications from the newly created subscription. This way, the client will only be aware of a `subscribeToSomething` business-specific endpoint, but won't see the set of filters the endpoint encapsulates. 

::: info
Note that the same restrictions can be achieved by adding a pipe on the `realtime:subscribe` API endpoint. The pipe would check the filters object and make the request fail if the filters are not allowed. This approach has two main downsides:
* you always need to be extremely careful when adding code to pipes that may result in failing requests, that's why code in pipes should always stay as light as possible;
* even if you are ensuring security through the pipe, you still have to specify the filters in the client-side, while you may want to leave this responsibility to the server-side.
:::

## `unsubscribe`

Removes a realtime subscription on an existing `roomId` and `connectionId`. The client listening on the given connection for the given room will stop receiving notifications.

---

### Arguments

```js
unsubscribe(connectionId, roomId, notify)
```

<br/>

| Argument | Type | Description |
|----------|------|-------------|
| `connectionId` | `String` | The id of the connection associated to the subscription |
| `roomId` | `String` | The id of the room associated to the subscription |
| `notify` | `Boolean` | Whether to notify or not the other clients in the room that one client stopped listening |

---

### Return

Resolves to void.

---

### Example

```js
async unregisterSubscription(request) {
  const connectionId = request.input.body.roomId || 
          request.context.connection.id,
    roomId = request.input.body.roomId;

  await this.context.accessors.realtime.unsubscribe(connectionId, roomId, false);

  return {
    acknowledged: 'OK'
  };
}
```