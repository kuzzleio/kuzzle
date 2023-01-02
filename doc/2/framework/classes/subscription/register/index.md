---
code: true
type: page
title: register | Framework | Core

description: Subscription class register() method
---

# register

<SinceBadge version="2.7.2" />

Registers a new realtime subscription on behalf of a client. The subscription works exactly like the one created by the [realtime:subscribe](/core/2/api/controllers/realtime/subscribe/) action. The notifications will be sent to the connection identified by the connection identifier passed to the method.

---

### Arguments

```ts
register(connectionId: string, index: string, collection: string, filters: JSONObject): Promise<{ roomId: string }>
```

<br/>

| Argument | Type | Description |
|----------|------|-------------|
| `connectionId` | <pre>string</pre> | Connection ID of the client that will receive the notifications |
| `index` | <pre>string</pre> | Index name |
| `collection` | <pre>string</pre> | Collection name |
| `filters` | <pre>object</pre> | Koncorde Filters |

---

### Return

Resolves to the room ID associated with the registered subscription.

---

### Example

```js
async subscribeToSomething(request) {
  const options = {};
  const roomId = await this.context.accessors.subscription.register(
    request.context.connection.id, 
    'myindex', 
    'mycollection', 
    {
      // subscription filters
    });
  return { roomId };
}
```

---

### Use cases

The most common use-case of this method is to implement the realtime subscriptions on the server-side. Instead of leaving the client-side with the freedom (and the responsibility) of specifying the filters for a subscription, you can open a custom API endpoint in your plugin and call `accessors.subscription.register` inside it by passing the incoming KuzzleRequest. When the client hits this endpoint, they will start receiving the notifications from the newly created subscription. This way, the client will only be aware of a `subscribeToSomething` business-specific endpoint, but won't see the set of filters the endpoint encapsulates. 

::: info
Note that the same restrictions can be achieved by adding a pipe on the `realtime:subscribe` API endpoint. The pipe would check the filters object and make the request fail if the filters are not allowed. This approach has two main downsides:
* you always need to be extremely careful when adding code to pipes that may result in failing requests, that's why code in pipes should always stay as light as possible;
* even if you are ensuring security through the pipe, you still have to specify the filters in the client-side, while you may want to leave this responsibility to the server-side.
:::
