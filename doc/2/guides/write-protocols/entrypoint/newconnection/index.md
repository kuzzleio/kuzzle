---
code: true
type: page
title: newConnection | Protocol Entrypoint | Write protocols | Guide
meta:
  - name: description
    content: Declares a new client connection to Kuzzle.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, protocol entrypoint, newConnection 
---

# newConnection



Declares a new client connection to Kuzzle.

---

### Arguments

```js
newConnection(connection);
```

<br/>

| Arguments    | Type                                                                               | Description         |
| ------------ | ---------------------------------------------------------------------------------- | ------------------- |
| `connection` | [`ClientConnection`](/core/2/guides/write-protocols/context/clientconnection) | New user connection |

---

### Example

```js
const conn = new context.ClientConnection('<protocol name>', ['127.0.0.1']);

entryPoint.newConnection(conn);
```
