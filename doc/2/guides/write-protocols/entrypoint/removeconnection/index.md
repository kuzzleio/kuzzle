---
code: true
type: page
title: removeConnection | Protocol Entrypoint | Write protocols | Guide
meta:
  - name: description
    content: Removes a client connection from Kuzzle.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, protocol entrypoint, removeConnection
---
# removeConnection



Removes a client connection from Kuzzle.

---

### Arguments

```js
removeConnection(connectionId);
```

<br/>

| Arguments      | Type              | Description                                                                                    |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `connectionId` | <pre>string</pre> | The [ClientConnection](/core/2/guides/write-protocols/context/clientconnection) unique identifier to remove |
