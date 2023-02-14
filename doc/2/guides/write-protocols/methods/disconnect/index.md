---
code: true
type: page
title: disconnect | Write protocols | Guide
meta:
  - name: description
    content: Asks the protocol to force-close a connection.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, disconnect
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
| `connectionId` | <pre>string</pre> | Connection unique identifier, previously registered by the protocol using [newConnection](/core/2/guides/write-protocols/entrypoint/newconnection) |

---

## Return

The `disconnect` function is not expected to return a value.
