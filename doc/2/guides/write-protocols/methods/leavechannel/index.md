---
code: true
type: page
title: leaveChannel | Write protocols | Guide
meta:
  - name: description
    content: Informs the protocol that one of its connected users left a channel.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, leaveChannel
---

# leaveChannel

Informs the protocol that one of its connected users left a [channel](/core/2/guides/write-protocols/start-writing-protocols#channels).

---

## Arguments

```js
leaveChannel(channel, connectionId);
```

<br/>

| Arguments      | Type              | Description                                                                                                                           |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`      | <pre>string</pre> | Left channel identifier                                                                                                               |
| `connectionId` | <pre>string</pre> | Connection unique identifier, previously registered by the protocol using [newConnection](/core/2/guides/write-protocols/entrypoint/newconnection) |

---

## Return

The `leaveChannel` function is not expected to return a value.
