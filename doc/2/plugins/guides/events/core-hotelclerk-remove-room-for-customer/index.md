---
code: true
type: page
title: core:hotelClerk:removeRoomForCustomer
---

# core:hotelClerk:removeRoomForCustomer


| Arguments        | Type              | Description                                                                                  |
| -----------------| ----------------- | -------------------------------------------------------------------------------------------- |
| `RequestContest` | <pre>object</pre> | [requestContext](https://docs.kuzzle.io/core/1/protocols/api/context/requestcontext/) object |
| `room`           | <pre>object</pre> | Joined room information in Koncorde format                                                   |

Triggered whenever a user is removed from a room. 

---

## room

The provided `room` object has the following properties:

| Properties     | Type                 | Description             |
| -------------- | -------------------- | ----------------------- |
| `id`           | <pre>string</pre>    | Room unique identifier  |
| `index`        | <pre>string</pre>    | Index                   |
| `collection`   | <pre>string</pre>    | Collection              |

---