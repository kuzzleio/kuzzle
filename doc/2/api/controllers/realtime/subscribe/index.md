---
code: true
type: page
title: subscribe | API | Core
---

# subscribe



Subscribes by providing a set of filters: messages, document changes and, optionally, user events matching the provided filters will generate [real-time notifications](/core/2/api/payloads/notifications), sent to you in real-time by Kuzzle.

---

## Query Syntax

### HTTP

Due to the synchronous nature of the HTTP protocol, real-time notifications are not supported.

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "realtime",
  "action": "subscribe",
  "body": {
    // subscription filters
  },
  "volatile": {
    // query volatile data
  },
  "scope": "<all|in|out|none>",
  "users": "<all|in|out|none>"
}
```

---

## Arguments

- `collection`: watched collection
- `index`: watched index

### Optional:

- `scope`: accepted values: `all`, `in`, `out`, `none` (default: `all`). Subscribe to either new documents entering the scope of the subscription filters (`in`), to documents leaving it (`out`), or both (`all`). Alternatively, document notifications can be ignored entirely (`none`)
- `users`: accepted values: `all`, `in`, `out`, `none` (default: `none`). Receive real-time notifications about users subscribing to the same filters (`in`), about users leaving the subscription (`out`), or both (`all`). If set to `none`, no notifications are sent about users
- `volatile`: subscription information, used in [user join/leave notifications](/core/2/guides/main-concepts/api#volatile-data)

---

## Body properties

Subscription filters, following the [Koncorde syntax](/core/2/api/koncorde-filters-syntax)

An empty filter subscribes to any change occuring on the selected index-collection pair.

---

## Response

Returns an object detailing the new subscription properties:

- `channel`: unique channel identifier. A channel acts as a subscription configuration ID, allowing multiple subscriptions to occur with the same filters, but different notification options.
- `roomId`: unique subscription identifier.

Notifications include the `room` property, which indicates to what channel the notification is for. This is how notifications can be linked to subscriptions by front-end applications (our SDK perform these operations automatically).

### Example

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "realtime",
  "action": "subscribe",
  "requestId": "<unique request identifier>",
  "result": {
    "roomId": "<unique Kuzzle room identifier>",
    "channel": "<unique channel identifier>"
  }
}
```
