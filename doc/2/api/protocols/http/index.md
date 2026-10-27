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

Other HTTP settings live in the top-level `http` section of the [configuration file](/core/2/guides/advanced/configuration): CORS headers (`accessControlAllowOrigin`, `accessControlAllowOriginUseRegExp`, `accessControlAllowMethods`, `accessControlAllowHeaders`), `cookieAuthentication` and custom `routes`. The annotated `.kuzzlerc.sample.jsonc` file describes each of them.

**HTTP protocol configuration section of the kuzzlerc:**

```js
  "server": {
    // The listening port for HTTP and WebSocket
    "port": 7512,

    "protocols": {
      "http": {
        // Set to "false" to disable HTTP support
        "enabled": true,

        // Maximum size of each part (file or field) of a
        // multipart/form-data request. A request with a larger part is
        // rejected with a network.http.file_too_large error (enforced
        // since Kuzzle 2.57.0).
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

| Property              | Type              | Description                                                                                                                                         |
| --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization`       | <pre>string</pre> | `Bearer <token>`: authentication token, obtained through [auth:login](/core/2/api/controllers/auth/login)                                           |
| `X-Kuzzle-Request-Id` | <pre>string</pre> | Custom request ID. Will be returned in the response.                                                                                                |
| `X-Kuzzle-Volatile`   | <pre>string</pre> | [Volatile data](/core/2/guides/main-concepts/api#volatile-data), as a JSON object. An invalid JSON value is rejected with `network.http.volatile_parse_failed` |

See also the [optional headers](/core/2/guides/main-concepts/api#optional-headers) about compression (`Accept-Encoding`, `Content-Encoding`).

### Probe and raw endpoints

Besides the API routes, Kuzzle answers on a few HTTP endpoints that do not map to an API action:

| Route               | Description                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /_query`      | Runs the request given in the body, written in the [standard JSON request format](/core/2/api/payloads/request) of the other protocols. See [JSON Query Endpoint](/core/2/guides/main-concepts/api#json-query-endpoint) |
| `GET /_healthcheck` | Liveness probe: always answers `200`, without checking any service and without being logged. Not to be confused with [server:healthCheck](/core/2/api/controllers/server/health-check) (`GET /_healthCheck`) |
| `GET /_ready`       | Readiness probe: answers `200` when the node is running and accepts requests, `503` otherwise. See [Ready endpoint](/core/2/guides/main-concepts/api#ready-endpoint) |
