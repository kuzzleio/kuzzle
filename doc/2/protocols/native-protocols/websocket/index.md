---
code: false
type: page
title: WebSocket
order: 0
---

# WebSocket

## Configuration

The protocol can be configured via the [kuzzlerc configuration file](/core/2/guides/essentials/configuration), under the `server > protocols > websocket` section.

| Option      | Type               | Description                                                                                                                    | Default |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `enabled`   | <pre>boolean</pre> | Enable/Disable WebSocket protocol support                                                                                      | `true`  |
| `heartbeat` | <pre>integer</pre> | The time, in milliseconds, between the server's PING requests. Setting this value to `0` disables PING/PONG requests entirely. | `60000` |

### Configure listening port

:::warning
HTTP, WebSocket and Socket.IO protocols share the same underlying server instance. Modifying the listening port will impact all these three protocols.
:::

By default, Kuzzle listens to the `7512` port.

The port can be modified under the `server > port` section of [Kuzzle configuration](/core/2/guides/essentials/configuration).
