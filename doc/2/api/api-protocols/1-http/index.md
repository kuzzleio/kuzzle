---
code: false
type: page
title: HTTP
description: HTTP protocol usage and configuration  
order: 100
---

# HTTP

The HTTP protocol is widely used to build APIs.  

This protocol consumes **less energy** and allows easily **compression** or **caching** of requests.  

::: info
The use of the HTTP protocol is recommended when the client is in an environment requiring energy saving. (e.g. IoT device, smartphone)
:::

However it is **quite slow** because each request requires to establish a new connection to the server.  

::: warning
The HTTP protocol cannot maintain a persistent connection and therefore it is not possible to use the features of the [Realtime Engine](/core/2/guides/main-concepts/6-realtime) 
::: 

### Configuration

The protocol can be configured under the `server.protocols.http` section of the [configuration file](/core/2/guides/essentials/configuration).

The listening port can be modified under the `server.port` section of the [configuration file](/core/2/guides/advanced/8-configuration).

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
        "allowCompression": true
      },
  }
```
::: warning
HTTP and WebSocket protocols share the same underlying server instance.  
Modifying the listening port will impact these two protocols.
:::
