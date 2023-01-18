---
type: page
code: false
order: 0
title: Properties | Protocol Entrypoint | Write protocols | Guide
meta:
  - name: description
    content: An instance of the EntryPoint class is provided as an argument to the protocol's required init function.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, protocol entrypoint, properties
---

# Properties

An instance of the `EntryPoint` class is provided as an argument to the protocol's required [init](/core/2/guides/write-protocols/methods/init) function.

That instance contains the necessary methods to make Kuzzle aware of user connections, and to pass API requests to Kuzzle.

---

## Properties

| Properties       | Type               | Description                                                                                                                                                                                                                                       |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`         | <pre>object</pre>  | Link to the `server` section of Kuzzle's [configuration](/core/2/guides/advanced/configuration) file. Custom configuration for the protocol can be found at the following path:<br/>`entryPoint.config.protocols.<protocol unique name>` |
| `httpServer`     | <pre>object</pre>  | Kuzzle's [HTTP server](https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_class_http_server)                                                                                                                                             |
| `isShuttingDown` | <pre>boolean</pre> | If `true`, then this Kuzzle node is shutting down, and it will kill itself once all ongoing requests are finished. This flag should be checked regularly and the network protocol should not accept any new request when it is active             |
