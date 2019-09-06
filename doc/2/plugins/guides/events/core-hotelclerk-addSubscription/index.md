---
code: true
type: page
title: core:hotelClerk:addSubscription
---

# core:hotelClerk:addSubscription


| Arguments  | Type              | Description                           |
| ---------- | ----------------- | ------------------------------------- |
| `subscription`     | <pre>object</pre> | Contains information about the added subscription |

Triggered whenever a [subscription](/core/2/api/controllers/realtime/subscribe) is added.

## subscription

The provided `subscription` object has the following properties:

| Properties     | Type                 | Description                                                                                                       |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `roomId`       | <pre>string</pre>    | Room unique identifier                                                                                    |
| `connectionId` | <pre>integer</pre>   | [ClientConnection](/core/2/protocols/api/context/clientconnection) unique identifier                          |
| `index`        | <pre>string</pre>    | Index                                                                                                             |
| `collection`   | <pre>string</pre>    | Collection                                                                                                        |
| `filters`      | <pre>object</pre>    | Filters in [Koncorde's normalized format](https://www.npmjs.com/package/koncorde#filter-unique-identifier)  |

---