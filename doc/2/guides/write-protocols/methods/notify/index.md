---
code: true
type: page
title:  Notify | Protocol Methods | Write protocols | Guide
meta:
  - name: description
    content: Asks the protocol to send data to a specific connection, on some of its channels.
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write protocols, start, notify
---

# notify

Asks the protocol to send data to a specific connection, on some of its [channels](/core/2/guides/write-protocols/start-writing-protocols#channels).

---

## Arguments

`notify(channels, connectionId, payload)`

- `channels` | <pre>string[]</pre> | list of channels
- `connectionId` | <pre>string</pre> | connection unique identifier, previously registered by the protocol using [newConnection](/core/2/guides/write-protocols/entrypoint/newconnection)
- `payload` | <pre>object</pre> | data payload

---

## Return

The `notify` function is not expected to return a value.
