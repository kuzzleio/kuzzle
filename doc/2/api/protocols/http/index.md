---
code: false
type: page
title: HTTP | API | Core
description: HTTP protocol usage and configuration
order: 100
---

# HTTP

The HTTP protocol is widely used to build APIs.

This protocol consumes **less energy** and easily allows **compression** or **caching** of requests.

::: info
The use of the HTTP protocol is recommended when the client is in an environment requiring energy saving. (e.g. IoT device, smartphone)
:::

However it can be **quite slow** because each request usually requires to establish a new connection to the server. Some clients, such as browsers, keep connections open to speed things up, but you shouldn't count on that.

::: warning
The HTTP protocol is not meant to maintain persistent connections. It is therefore not possible to use Kuzzle's [Realtime Engine](/core/2/guides/main-concepts/realtime-engine)
:::

### Configuration

The protocol can be configured under the `server.protocols.http` section of the [configuration file](/core/2/guides/advanced/configuration).

The listening port can be modified under the `server.port` section of the [configuration file](/core/2/guides/advanced/configuration).

**HTTP protocol configuration section of the kuzzlerc:**

```js
  "server": {
    // The listening port for HTTP and WebSocket
    "port": 7512,

    "protocols": {
      "http": {
        // Set to "false" to disable HTTP support
        "enabled": true,

        // Maximum size of requests sent via http forms
        "maxFormFileSize": "1mb",

        // Maximum number of encoding layers that can be applied
        // to an http message, using the Content-Encoding header.
        // This parameter is meant to prevent abuses by setting an
        // abnormally large number of encodings, forcing Kuzzle to
        // allocate as many decoders to handle the incoming request.
        "maxEncodingLayers": 3,

        // Enable support for compressed requests, using the
        // Content-Encoding header
        // Currently supported compression algorithms:
        //   gzip, deflate, identity
        // Note: "identity" is always an accepted value, even if
        // compression support is disabled
        "allowCompression": true,

        // Enables Kuzzle to accept additional Content-Types.
        // Note: This relies on the implementation of a
        // "protocol:http:beforeParsingPayload" pipe that implements
        // the formatting of the additional content types to JSON.
        // The default content types are:
        //  * application/json
        //  * application/x-www-form-urlencoded
        //  * multipart/form-data
        "additionalContentTypes": [],
      },
  }
```

::: warning
HTTP and WebSocket protocols share the same underlying server instance.
Modifying the listening port will impact these two protocols.
:::

### HTTP-only options

Only the HTTP protocol does support the following options in a [KuzzleRequest](/core/2/api/payloads/request)

| Property | Type               | Description                                                    |
| -------- | ------------------ | -------------------------------------------------------------- |
| `pretty` | <pre>boolean</pre> | Prettify the JSON response, making it more readable for humans |

### HTTP headers

| Property              | Type              | Description                                          |
| --------------------- | ----------------- | ---------------------------------------------------- |
| `X-Kuzzle-Request-Id` | <pre>string</pre> | Custom request ID. Will be returned in the response. |
