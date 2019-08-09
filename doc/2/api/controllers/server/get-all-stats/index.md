---
code: true
type: page
title: getAllStats
---

# getAllStats



Gets all stored internal statistic snapshots.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_getAllStats
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "getAllStats"
}
```

---

## Response

Returns a statistic objects with the following properties:

- `hits`: an array of statistic snapshots. By default, snapshots are made every 10 seconds and they are stored for 1 hour. Each snapshot is an object with the following properties:
  - `completedRequests`: completed requests, per network protocol
  - `connections`: number of active connections, per network protocol
  - `failedRequests`: failed requests, per network protocol
  - `ongoingRequests`: requests underway, per network protocol
  - `timestamp`: snapshot timestamp, in Epoch-millis format
- `total`: total number of available snapshots

```js
{
  "status": 200,
  "error": null,
  "action": "getAllStats",
  "controller": "server",
  "requestId": "<unique request identifier>",
  "result": {
    "total": 1,
    "hits": [
      {
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
    ]
  }
}
```
