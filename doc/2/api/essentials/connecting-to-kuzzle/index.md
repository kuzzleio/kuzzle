---
code: false
type: page
title: Connecting to Kuzzle
description: Connecting to Kuzzle using HTTP, WebSocket or Protocol plugins
order: 100
---

# Connecting to Kuzzle

A connection to Kuzzle can be made using different protocols. Currently Kuzzle natively supports HTTP, WebSocket and MQTT, but other protocols can be added by implementing the [Protocol](/core/2/protocols) interface.

---

## HTTP

By default, Kuzzle can be reached via HTTP on port 7512. Thus, assuming the Kuzzle server is running locally, it can be reached at `http://localhost:7512/`.

The default response for the root endpoint is the [server:info](/core/2/api/controllers/server/info) action which gives detailed information about the available HTTP API routes.

### Example

```bash
curl "http://localhost:7512/"
```

---

## WebSocket

By default, Kuzzle has websockets enabled, accepting requests via the http server on port 7512.

### Example

```html
<script>
  var socket = new WebSocket('ws://localhost:7512');
</script>
```

---

## MQTT

By default, Kuzzle has its MQTT protocol disabled. To enable it, set the following key to `true` in [Kuzzle's configuration files](/core/2/guides/essentials/configuration): `server.protocols.mqtt.enabled`

### Example

```bash
# shell 1
node_modules/.bin/mqtt subscribe -v -h rabbit -t Kuzzle

# shell 2
node_modules/.bin/mqtt publish -h rabbit -t Kuzzle -m '{
  "collection":"index",
  "collection":"collection",
  "controller": "document",
  "action": "createOrReplace",
  "body": {
    "firstName": "John",
    "lastName": "Doe"
  }
}'

# shell 1 (prettified)
Kuzzle {
  "error": null,
  "result": {
    "_id": "AVF8NG3k5ZVpUuiPrN1K",
    "_index": "index",
    "_source": {"firstName":"John", "lastName":"Doe"},
    "_type": "collection",
    "_version": 1,
    "action": "createOrReplace",
    "collection": "collection",
    "controller": "document",
    "created": true,
    "volatile": {},
    "requestId":"5cb4d930-62f4-4393-afc1-9a71e284a214"
  },
  "status": 200
}
```

By default, Kuzzle listens to MQTT messages on port 1883.

:::info
The examples given in this documentation use the CLI client from the mqtt Node.js
library that is shipped in the Kuzzle Docker image.  
To test them out yourself you will need to enter into the container shell once your docker compose stack is up and running:  
`docker exec -ti kuzzle_kuzzle_1 bash`
:::
