---
code: true
type: page
title: join
---

# join

<DeprecatedBadge version="1.8.0" />

Joins a previously created subscription.

---

## Query Syntax

### HTTP

Due to the synchronous nature of the HTTP protocol, real-time messaging is not supported

### Other protocols

```js
{
  "controller": "realtime",
  "action": "join",
  "body": {
    "roomId": "<subscription identifier>"
  },
  // optional
  "volatile": {}
}
```

---

## Arguments

### Optional:

- `volatile`: subscription information, used in [user join/leave notifications](/core/2/guides/main-concepts/api#volatile-data).

---

## Body properties

- `roomId`: subscription identifier, returned by Kuzzle during upon a successful subscription

---

## Response

Returns a `roomId` property containing the subscription identifier.

```js
{
  "status": 200,
  "error": null,
  "index": null,
  "collection": null,
  "controller": "realtime",
  "action": "subscribe",
  "volatile": {},
  "requestId": "<unique request identifier>",
  "result": {
    "channel": "<unique channel identifier>",
    "roomId": "<unique Kuzzle room identifier>"
  }
}
```
