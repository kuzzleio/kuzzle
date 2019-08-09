---
code: false
type: page
title: HTTP
order: 0
---

# HTTP

## Configuration

The protocol can be configured via the [kuzzlerc configuration file](/core/1/guides/essentials/configuration), under the `server > protocols > http` section.

| Option              | Type               | Description                                                                                                                                                                                                                                                                           | Default |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `enabled`           | <pre>boolean</pre> | Enable/Disable HTTP protocol support                                                                                                                                                                                                                                                  | `true`  |
| `maxFormFileSize`   | <pre>string</pre>  | Maximum size of requests sent via http forms                                                                                                                                                                                                                                          | `1mb`   |
| `maxEncodingLayers` | <pre>integer</pre> | Maximum number of encoding layers that can be applied to an http message, using the Content-Encoding header. This parameter is meant to prevent abuses by setting an abnormally large number of encodings, forcing Kuzzle to allocate as many decoders to handle the incoming request | `3`     |
| `allowCompression`  | <pre>boolean</pre> | Enable support for compressed requests, using the Content-encoding header. Currently supported compression algorithms: gzip, deflate, identity. Note: "identity" is always an accepted value, even if compression support is disabled                                                 | `true`  |

### Configure listening port

:::warning
HTTP, WebSocket and Socket.IO protocols share the same underlying server instance. Modifying the listening port will impact all these three protocols.
:::

By default, Kuzzle listens to the `7512` port.

The port can be modified under the `server > port` section of [Kuzzle configuration](/core/1/guides/essentials/configuration).

## Limitations

Due to the synchronous nature of the HTTP protocol, real-time messaging is not supported.
