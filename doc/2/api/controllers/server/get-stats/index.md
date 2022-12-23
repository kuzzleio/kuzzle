---
code: true
type: page
title: getStats | API | Core
---

# getStats

<DeprecatedBadge version="2.16.0" />

Returns statistics snapshots within a provided timestamp range.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_getStats[?startTime=<Epoch-millis>][&stopTime=<Epoch-millis>]
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "getStats",
  "startTime": <timestamp>,
  "stopTime": <timestamp>
}
```

---

## Response

Returns the found statistic snapshots in the following format:

- `hits`: array of statistic snapshots. By default, snapshots are made every 10 seconds and they are stored for 1 hour. Each snapshot is an object with the following properties:
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
  "action": "getStats",
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
