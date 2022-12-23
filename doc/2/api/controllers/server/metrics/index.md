---
code: true
type: page
title: metrics | API | Core
---

# metrics

<SinceBadge version="2.16.0"/>

Returns inner metrics directly from the current Kuzzle node core components.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_metrics
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "metrics"
}
```

---

## Response

Returns the found statistic snapshots in the following format:

- `api`: current node API funnel metrics
  - `concurrentRequests`: number of concurrent requests currently executed.
  - `pendingRequests`: number of requests waiting for execution
- `network`: current node router metrics
  - `connections`: number of active connections, per network protocol
- `realtime`: current node realtime hotelClerk metrics
  - `rooms`: number of active realtime rooms
  - `subscriptions`: number of active subscriptions 



```js
{
  "status": 200,
  "error": null,
  "action": "metrics",
  "controller": "server",
  "requestId": "<unique request identifier>",
  "result": {
    "api":{
      "concurrentRequests": 1,
      "pendingRequests": 0
    },
    "network": {
      "connections": {
        "websocket": 1,
        "http/1.1": 1
      }
    },
    "realtime": {
     "rooms": 1,
     "subscriptions": 1
    }
  }
}
```
