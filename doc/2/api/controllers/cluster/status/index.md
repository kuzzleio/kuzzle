---
code: true
type: page
title: status
---

# status

<SinceBadge version="auto-version"/>

Gets the current cluster status.

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_cluster/status
Method: GET
```

### Other protocols

```js
{
  "controller": "cluster",
  "action": "status"
}
```

---

## Response

Returns the current cluster status:

```
{
  "action": "status",
  "controller": "cluster",
  "error": null,
  "node": "mixed-brachiosaurus-45773",
  "result": {
    "activeNodes": 2,
    "activity": [
      {
        "address": "172.29.0.6",
        "date": "2021-02-02T13:11:31.654Z",
        "event": "joined",
        "id": "entertaining-hera-63037"
      },
      {
        "address": "172.29.0.4",
        "date": "2021-02-02T13:11:31.922Z",
        "event": "joined",
        "id": "material-ghostwriter-77846"
      },
      {
        "address": "172.29.0.5",
        "date": "2021-02-02T13:11:32.102Z",
        "event": "joined",
        "id": "mixed-brachiosaurus-45773"
      },
      {
        "address": "172.29.0.6",
        "date": "2021-02-02T13:11:37.790Z",
        "event": "evicted",
        "id": "entertaining-hera-63037",
        "reason": "heartbeat timeout"
      }
    ],
    "nodes": [
      {
        "address": "172.29.0.5",
        "birthdate": "2021-02-02T13:11:32.032Z",
        "id": "mixed-brachiosaurus-45773"
      },
      {
        "address": "172.29.0.4",
        "birthdate": "2021-02-02T13:11:30.423Z",
        "id": "material-ghostwriter-77846"
      }
    ]
  },
  "status": 200,
}
```
