---
code: true
type: page
title: ClientConnection
---

# ClientConnection



The `ClientConnection` class must be instantiated whenever a new client connection is created, and that instance must be provided to the [entryPoint.newConnection](/core/2/protocols/api/entrypoint/newconnection) method.

---

## Arguments

```js
new context.ClientConnection(protocol, ips, headers);
```

<br/>

| Arguments  | Type                | Description                                                                             |
| ---------- | ------------------- | --------------------------------------------------------------------------------------- |
| `protocol` | <pre>string</pre>   | The protocol unique identifier                                                          |
| `ips`      | <pre>string[]</pre> | List of forwarded ip addresses (or any client connection information) of the connection |
| `headers`  | <pre>object</pre>   | Extra connection information                                                            |
