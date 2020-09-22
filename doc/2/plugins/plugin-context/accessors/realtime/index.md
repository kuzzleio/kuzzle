---
code: true
type: page
title: registerSubscription
---

# `realtime`

Add or remove [real-time subscriptions](/core/2/guides/essentials/real-time) from the backend.

## `registerSubscription`

Registers a new realtime subscription. The subscription works exaclty like the one created by the [`realtime:subscribe` API endpoint](/api/controllers/realtime/subscribe/index.md). The notifications will be sent to the connection identified by the `Request` object passed to the method.

---

### Arguments

```js
registerSubscription(request)
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
async customAction(request) {
  const filters = {
    equals: {
      myAttribute: 'my-value'
    }
  }
  const options = {}
  const roomId = await this.context.accessors.registerSubscription(
        request.context.connection.id,
        'myindex',
        'mycollection',
        filters,
        options
      );
  return { roomId }
}
```

---

### Use cases

The most common use-case of this method is to implement the realtime subscriptions on the server-side. Instead of leaving the client-side with the freedom (and the responsibility) of specifying the filters for a subscription, you can open a custom API endpoint in your plugin and call `registerSubscription` inside it by passing the incoming Request. When the client hits this endpoint, they will start receiving the notifications from the newly created subscription. This way, the client will only be aware of a `subscribeToSomething` business-specific endpoint, but won't see the set of filters the endpoint encapsulates. 

::: info
Note that the same restriction can be achieved by adding a pipe on the `realtime:subscribe` API endpoint. The pipe would check the filters object and make the request fail if the filters are not allowed. This approach has two main downsides:
* you always need to be extremely careful when adding code to pipes that may result in failing requests, that's why code in pipes should always stay as light as possible;
* even if you are ensuring security through the pipe, you still have to specify the filters in the client-side, while you may want to leave this responsibility to the server-side.
:::