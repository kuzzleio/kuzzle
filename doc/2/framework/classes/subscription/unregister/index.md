---
code: true
type: page
title: unregister
description: Subscription class unregister() method
---

# unregister


Removes a realtime subscription on an existing `roomId` and `connectionId`. The client listening on the given connection for the given room will stop receiving notifications.

---

### Arguments

```js
unregister(connectionId: string, roomId: string, notify: boolean): Promise<void>
```

<br/>

| Argument | Type | Description |
|----------|------|-------------|
| `connectionId` | <pre>string</pre> | The id of the connection associated to the subscription |
| `roomId` | <pre>string</pre> | The id of the room associated to the subscription |
| `notify` | <pre>boolean</pre> | Whether to notify or not the other clients in the room that one client stopped listening |

---

### Return

Resolves to void.

---

### Example

```js
async unregisterSubscription (request) {
  const connectionId = request.context.connection.id;
  const roomId = request.input.body.roomId;

  await this.context.accessors.subscription.unregister(
    connectionId, 
    roomId, 
    false);
}
```
