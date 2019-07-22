---
code: true
type: page
title: unsubscribe
---

# unsubscribe



Removes a subscription.

---

## Query Syntax

### HTTP

Due to the synchronous nature of the HTTP protocol, real-time messaging is not supported

### Other protocols

```js
{
  "controller": "realtime",
  "action": "unsubscribe",
  "body": {
    "roomId": "<unique room ID>"
  }
}
```

---

## Body properties

- `roomId`: subscription identifier to room

---

## Response

Returns the removed subscription identifier.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "realtime",
  "action": "unsubscribe",
  "volatile": {}, // subscription volatile data
  "requestId": "<unique request identifier>",
  "result": {
    "roomId": "<unique Kuzzle room identifier>"
  }
}
```
