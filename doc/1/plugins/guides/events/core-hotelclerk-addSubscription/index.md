---
code: true
type: page
title: core:hotelClerk:addSubscription
---

# core:hotelClerk:addSubscription


| Arguments  | Type              | Description                           |
| ---------- | ----------------- | ------------------------------------- |
| `diff`     | <pre>object</pre> | Contains information about subscription |

Triggered whenever a [subscription](/core/1/api/controllers/realtime/subscribe) is added.

## diff

The provided `diff` object has the following properties:

| Properties     | Type                 | Description                                                                                                       |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `roomId`       | <pre>integer</pre>   | New room unique identifier                                                                                    |
| `connectionId` | <pre>integer</pre>   | [ClientConnection](/core/1/protocols/api/context/clientconnection) unique identifier                          |
| `index`        | <pre>string</pre>    | Index                                                                                                             |
| `collection`   | <pre>string</pre>    | Collection                                                                                                        |
| `filters`      | <pre>object</pre>    | [Filters](https://docs.kuzzle.io/core/1/guides/cookbooks/realtime-api/terms/) to match with                       |
| `changed`      | <pre>boolean</pre>   | Indicates if a channel was associated to the current `roomId` or if the room was associated to the `connectionId` |

---
