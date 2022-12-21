---
code: true
type: page
title:  broadcast | Write protocols | Guide
meta:
  - name: description
    content: Asks the protocol to emit a payload to channels.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, broadcast
---
# broadcast

Asks the protocol to emit a payload to [channels](/core/2/guides/write-protocols/start-writing-protocols#channels).

---

## Arguments

```js
broadcast(channels, payload);
```

<br/>

| Arguments  | Type                | Description      |
| ---------- | ------------------- | ---------------- |
| `channels` | <pre>string[]</pre> | List of channels |
| `payload`  | <pre>object</pre>   | Data payload     |

---

## Return

The `broadcast` function is not expected to return a value.
