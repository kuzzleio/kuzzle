---
code: false
type: page
title: Socket.IO
order: 0
---

# Socket.IO

## Configuration

The protocol can be configured via the [kuzzlerc configuration file](/core/1/guides/essentials/configuration/), under the `server > protocols > socketio` section.

| Option    | Type               | Description                                                               | Default |
| --------- | ------------------ | ------------------------------------------------------------------------- | ------- |
| `enabled` | <pre>boolean</pre> | Enable/Disable Socket.IO protocol support                                 | `true`  |
| `origins` | <pre>string</pre>  | Value of Access-Control-Allow-Origin header to answer the upgrade request | `*:*`   |

### Configure listening port

:::warning
HTTP, WebSocket and Socket.IO protocols share the same underlying server instance. Modifying the listening port will impact all these three protocols.
:::

By default, Kuzzle listens to the `7512` port.

The port can be modified under the `server > port` section of [Kuzzle configuration](/core/1/guides/essentials/configuration/).
