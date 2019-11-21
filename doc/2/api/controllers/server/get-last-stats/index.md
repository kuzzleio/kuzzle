---
code: true
type: page
title: getLastStats
---

# getLastStats



Returns the most recent statistics snapshot.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_getLastStats
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "getLastStats"
}
```

---

## Response

Returns the last statistic snapshot, with the following properties:

- `completedRequests`: completed requests, per network protocol
- `connections`: number of active connections, per network protocol
- `failedRequests`: failed requests, per network protocol
- `ongoingRequests`: requests underway, per network protocol
- `timestamp`: snapshot timestamp, in Epoch-millis format

```js
{
  "status": 200,
  "error": null,
  "action": "getLastStats",
  "controller": "server",
  "requestId": "<unique request identifier>",
  "result": {
    "completedRequests": {
      "websocket": 148,
      "http": 24,
      "mqtt": 78
    },
    "failedRequests": {
      "websocket": 3
    },
    "ongoingRequests": {
      "mqtt": 8,
      "http": 2
    }
    "connections": {
      "websocket": 13
    },
    "timestamp": 1453110641308
  }
}
```
