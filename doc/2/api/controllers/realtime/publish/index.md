---
code: true
type: page
title: publish | API | Core
---

# publish



Sends a real-time message to Kuzzle. The message will be dispatched to all clients with subscriptions matching the index, the collection and the message content.

A `_kuzzle_info` object will be added to the message content, with the following properties:

- `author`: sender kuid (or `-1` if the message is sent by an anonymous connection)
- `createdAt`: message timestamp, using the Epoch-millis format

**Note:** real-time messages are not persisted in the database.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_publish
Method: POST
Body:
```

```js
{
  // message content
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "realtime",
  "action": "publish",
  "body": {
    // message content
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

Message content.

---

## Response

Returns the sent message.

```js
{
  "error": null,
  "status": 200,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "realtime",
  "action": "publish",
  "requestId": "<unique request identifier>",
  "result": {
    "published": true
  }
}
```
