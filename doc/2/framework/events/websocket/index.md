---
type: page
code: false
title: Websocket | Framework | Core

description: Websocket events list
order: 100
---

# Websocket Events

## protocol:websocket:beforeParsingPayload

<SinceBadge version="2.19.12" />

| Arguments | Type              | Description                         |
| --------- | ----------------- | ----------------------------------- |
| `event`   | <pre>object</pre> | Client connection and raw payload   |

Triggered when a message is received on a WebSocket connection, before it is parsed.

The `event` object has the following properties:

| Properties   | Type              | Description                      |
| ------------ | ----------------- | -------------------------------- |
| `connection` | <pre>object</pre> | The client connection (`id`, `protocol`, `ips`, `headers`) |
| `payload`    | <pre>string</pre> | The raw message                  |

Pipes must resolve to an object of the same shape: its `payload` is the message that Kuzzle parses.

## protocol:websocket:afterParsingPayload

<SinceBadge version="2.19.12" />

| Arguments | Type              | Description                           |
| --------- | ----------------- | ------------------------------------- |
| `event`   | <pre>object</pre> | Client connection and decoded payload |

Triggered once a WebSocket message has been parsed as JSON.

The `event` object has the following properties:

| Properties   | Type                  | Description                                                |
| ------------ | --------------------- | ---------------------------------------------------------- |
| `connection` | <pre>object</pre>     | The client connection (`id`, `protocol`, `ips`, `headers`) |
| `payload`    | <pre>JSONObject</pre> | The decoded message                                        |

Pipes must resolve to an object of the same shape: its `payload` becomes the API request.
