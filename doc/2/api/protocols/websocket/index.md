---
code: false
type: page
title: WebSocket | API | Core
description: WebSocket protocol usage and configuration  
order: 200
---

# WebSocket

The WebSocket protocol is a fairly widespread web standard. It allows to **establish a bidirectional communication channel** between a client and a server.

Due to the persistent nature of its connection, the WebSocket protocol **consumes more energy than HTTP**.

However, it is much **more efficient in sending requests** than HTTP because it does not need to establish a new connection for each new request.

::: info
The use of the **WebSocket protocol is recommended** whenever possible.  
This protocol should be used by default for web applications, machine-to-machine connections, users scripts and CLIs.
:::

### Configuration

The protocol can be configured under the `server.protocols.websocket` section of the [configuration file](/core/2/guides/advanced/configuration).

The listening port can be modified under the `server.port` section of the [configuration file](/core/2/guides/advanced/configuration).

**WebSocket protocol configuration section of the kuzzlerc:**

```js
  "server": {
    // The listening port for HTTP and WebSocket
    "port": 7512,

    "protocols": {
      "websocket": {
        // Set to true to enable WebSocket support
        "enabled": true,

        // The maximum time (in milliseconds) without sending or receiving a
        // message from a client. Once reached, the client's socket is
        // forcibly closed.
        // If a client socket is inactive for too long, the server will send
        // a PING request before closing the socket.
        // Minimum value: 1000 (but it's strongly advised to not set a value
        // this low to forcibly close idle client sockets)
        "idleTimeout": 0,

        // @Deprecated
        // The time, in milliseconds, between the server's PING requests to
        // clients, to make sure they are still active.
        // Setting this value to 0 disables PING requests from the server
        // (it will still respond with a PONG to PING requests from clients).
        // If heartbeat is deactivated, then setting a non-zero value to
        // idleTimeout is strongly recommended to detect and remove
        // dead sockets.
        "heartbeat": 60000,

        // Enable/Disable per message compression
        "compression": false,

        // The maximum number of messages per second a single socket can
        // submit to the server.
        // Requests exceeding that rate limit are rejected.
        // Disabled if set to 0.
        "rateLimit": 0,

        // Set to "true" to enable realtime notifications like "TokenExpired" 
        // notifications
        "realtimeNotifications": true,

        // Whether or not we should automatically send pings to uphold a stable 
        // connection given whatever idleTimeout.
        "sendPingsAutomatically": false,

        // This one depends on kernel timeouts and is a bad default
        "resetIdleTimeoutOnSend": false,
      }
  }
```

::: warning
HTTP and WebSocket protocols share the same underlying server instance.  
Modifying the listening port will impact these two protocols.
:::


<SinceBadge version="2.10.0" />

### Ping / Pong keep-alive

Though Kuzzle's WebSocket server is fully compliant with the [RFC6455](https://tools.ietf.org/html/rfc6455#section-5.5.2), meaning (among other things) that Kuzzle will respond to PING packets with standard PONG ones, an additional PING request has been added in the protocol's application layer.

This application-level PING has been especially added for web browsers, which don't allow sending PING packets. This can be troublesome if a web application needs to know if a connection has been severed, or if Kuzzle is configured to be in passive mode (i.e. it won't send PING requests by itself, and will close sockets if they are idle for too long).

When run in a browser, our Javascript SDK uses that feature for its keep-alive mechanism: a message will periodically be sent to Kuzzle in the form `"{"p":1}"` through websocket.
That message will call a response from Kuzzle in the form `"{"p":2}"` for the SDK to keep the connection alive.

