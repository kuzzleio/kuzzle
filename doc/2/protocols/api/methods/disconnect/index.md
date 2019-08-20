---
code: true
type: page
title: disconnect
---

# disconnect

Asks the protocol to force-close a connection.

---

## Arguments

```js
disconnect(connectionId);
```

<br/>

| Arguments      | Type              | Description                                                                                                                           |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `connectionId` | <pre>string</pre> | Connection unique identifier, previously registered by the protocol using [newConnection](/core/2/protocols/api/entrypoint/newconnection) |

---

## Return

The `disconnect` function is not expected to return a value.
