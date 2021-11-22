---
code: true
type: page
title: metrics
---

# metrics



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

- `funnel`: current node API funnel metrics
  - `concurrentRequests`: number of concurrent requests currently executed.
  - `pendingRequests`: number of requests waiting for execution
- `hotelClerk`: current node realtime hotelClerk metrics
  - `rooms`: number of active realtime rooms
  - `subscriptions`: number of active subscriptions 
- `router`: current node router metrics
  - `connections`: number of active connections, per network protocol



```js
{
  "status": 200,
  "error": null,
  "action": "metrics",
  "controller": "server",
  "requestId": "<unique request identifier>",
  "result": {
    "funnel":{
      "concurrentRequests": 1,
      "pendingRequests": 0
    },
    "hotelClerk": {
     "rooms": 1,
     "subscriptions": 1
    },
    "router": {
      "connections": {
        "internal": 1,
        "websocket": 1,
        "HTTP/1.1": 1
      }
    }
  }
}
```
