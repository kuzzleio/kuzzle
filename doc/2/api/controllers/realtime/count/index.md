---
code: true
type: page
title: count | API | Core
---

# count



Returns the number of other connections sharing the same subscription.

---

## Query Syntax

### HTTP

Due to the synchronous nature of the HTTP protocol, real-time messaging is not supported

### Other protocols

```js
{
  "controller": "realtime",
  "action": "count",
  "body": {
    "roomId": "unique room ID"
  }
}
```

---

## Body properties

- `roomId`: subscription identifier, returned by Kuzzle during upon a successful subscription

---

## Response

Returns an object with the following properties:

- `count`: number of active connections using the same provided subscription
- `roomId`: subscription identifier

```js
{
  "status": 200,
  "error": null,
  "index": null,
  "collection": null,
  "controller": "realtime",
  "action": "count",
  "requestId": "<unique request identifier>",
  "result": {
    "roomId": "<unique Kuzzle room identifier>",
    "count": 3,
  }
}
```
