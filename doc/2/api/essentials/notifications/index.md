---
code: false
type: page
title: Real-time Notifications
order: 500
---

# Real-time Notifications

Clients can [subscribe](/core/1/api/controllers/realtime/subscribe/) to documents, messages and events, in order to receive a notification whenever a change occurs matching the subscription scope.

---

## Documents changes & messages

The following notifications are sent by Kuzzle whenever one of the following event matches the subscription filters:

- A real-time message is sent
- A new document has been created
- A document has been updated or replaced
- <DeprecatedBadge version="1.5.0" /> A document is about to be created (creation not guaranteed)

Real-time notifications are also sent when documents, previously in the subscription scope, are leaving it because of the following events:

- document is deleted
- document is updated/replaced and its new content do not match the subscription filters anymore
- <DeprecatedBadge version="1.5.0" /> document is about to be deleted (deletion not guaranteed)

### Format

A document notification contains the following fields:

| Property     | Type   | Description                                                                                                              |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `action`     | string | API controller's action                                                                                                  |
| `collection` | string | Data collection                                                                                                          |
| `controller` | string | API controller                                                                                                           |
| `index`      | string | Data index                                                                                                               |
| `protocol`   | string | Network protocol used to modify the document                                                                             |
| `result`     | object | Notification content                                                                                                     |
| `room`       | string | Subscription channel identifier. Can be used to link a notification to its corresponding subscription                    |
| `scope`      | string | `in`: document enters (or stays) in the scope<br/>`out`: document leaves the scope                                       |
| `state`      | string | <DeprecatedBadge version="1.5.0" /><br/>`done`: the change has been applied<br/>`pending`: the change is about to happen | `pending`, `done` |
| `timestamp`  | number | Timestamp of the event, in Epoch-millis format                                                                           |
| `type`       | string | `document`: the notification type                                                                                        |
| `volatile`   | object | Request [volatile data](/core/1/api/essentials/volatile-data/)                                                           |

The `result` object is the notification content, and it has the following structure:

| Property  | Type   | Description                                                                                                                      |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `_id`     | string | Document unique ID<br/>`null` if the notification is from a real-time message                                                    |
| `_meta`   | object | <DeprecatedBadge version="1.3.0" /><br/>Document metadata information (creation time, last update time, and so on). Can be null. |
| `_source` | object | The message or full document content. Not present if the event is about a document deletion                                      |

### Example

```js
{
  "index": "foo",
  "collection": "bar",
  "controller": "document",
  "action": "create",
  "protocol": "http",
  "timestamp": 1497513122738,
  "volatile": null,
  "scope": "in",
  "state": "done",
  "result":{
    "_source":{
      "some": "document content",
      "_kuzzle_info": {
        "author": "<author kuid>",
        "createdAt": 1497866996975,
        "active": true
      }
    },
    "_id": "<document identifier>"
  },
  "room":"893e183fc7acceb5-7a90af8c8bdaac1b"
}
```

---

## User Notification

User notifications are triggered by the following events:

- A user subscribes to the same room
- A user leaves that room

These notifications are sent only if the `users` argument is set to any other value than the default `none` one (see [subscription request](/core/1/api/controllers/realtime/subscribe/)).

### Format

| Property     | Type   | Description                                                                                           |
| ------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `action`     | string | API controller's action                                                                               |
| `collection` | string | Data collection                                                                                       |
| `controller` | string | API controller                                                                                        |
| `index`      | string | Data index                                                                                            |
| `protocol`   | string | Network protocol used by the entering/leaving user                                                    |
| `result`     | object | Notification content                                                                                  |
| `room`       | string | Subscription channel identifier. Can be used to link a notification to its corresponding subscription |
| `timestamp`  | number | Timestamp of the event, in Epoch-millis format                                                        |
| `type`       | string | `user`: the notification type                                                                         |
| `user`       | string | `in`: a new user has subscribed to the same filters<br/>`out`: a user cancelled a shared subscription |
| `volatile`   | object | Request [volatile data](/core/1/api/essentials/volatile-data/)                                        |

The `result` object is the notification content, and it has the following structure:

| Property | Type   | Description                                        |
| -------- | ------ | -------------------------------------------------- |
| `count`  | number | Updated users count sharing that same subscription |

### Example

```js
{
  "index": "<index name>",
  "collection": "<collection name>",
  "controller": "realtime",
  "action": "subscribe",
  "protocol": "websocket",
  "timestamp": 1497517009931,
  "user": "in",
  "result": {
    "count": 42
  },
  "volatile": {
    "fullname": "John Snow",
    "favourite season": "winter",
    "goal in life": "knowing something"
  }
}
```

---

## Server Notification

Server notifications are triggered by global events, and they are sent to all of a client's subscriptions at the same time.

Currently, the only event generating a server notification is when an [authentication token](/core/1/guides/essentials/user-authentication/) has expired, closing the subscription.

Other events may be added in the future.

### Format

| Property  | Type   | Value                                                              |
| --------- | ------ | ------------------------------------------------------------------ |
| `message` | string | Server message explaining why this notification has been triggered |
| `type`    | string | `TokenExpired`: notification type                                  |

### Example

```js
{
  "message": "Authentication Token Expired",
  "type": "TokenExpired"
}
```
