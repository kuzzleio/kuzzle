---
type: page
code: false
title: Realtime | Framework | Core

description: Realtime events list
order: 100
---

# Realtime events

This page contains all non-API events related to realtime actions in Kuzzle.

---

## core:hotelClerk:addSubscription

This event is deprecated and will be removed in the next major version of Kuzzle.

Use `core:realtime:user:subscribe:after` instead.

<DeprecatedBadge version="2.5.0">

| Arguments      | Type              | Description                                       |
| -------------- | ----------------- | ------------------------------------------------- |
| `subscription` | <pre>object</pre> | Contains information about the added subscription |

Triggered whenever a [subscription](/core/2/api/controllers/realtime/subscribe) is added.

### subscription

The provided `subscription` object has the following properties:

| Properties     | Type               | Description                                                                                                    |
| -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `roomId`       | <pre>string</pre>  | Room unique identifier                                                                                         |
| `connectionId` | <pre>string</pre>  | [ClientConnection](/core/2/guides/write-protocols/context/clientconnection) unique identifier                  |
| `index`        | <pre>string</pre>  | Index                                                                                                          |
| `collection`   | <pre>string</pre>  | Collection                                                                                                     |
| `filters`      | <pre>object</pre>  | Filters in [Koncorde's normalized format](https://github.com/kuzzleio/koncorde/wiki/Filter-Unique-Identifiers) |
| `changed`      | <pre>boolean</pre> | Always `true`                                                                                                  |

</DeprecatedBadge>

---

## core:hotelClerk:removeRoomForCustomer

This event is deprecated and will be removed in the next major version of Kuzzle.

Use `core:realtime:user:unsubscribe:after` instead.

<DeprecatedBadge version="2.5.0">

| Arguments | Type              | Description                              |
| --------- | ----------------- | ---------------------------------------- |
| `payload` | <pre>object</pre> | Request context and left room, see below |

Triggered whenever a user is removed from a room.

### payload

The provided `payload` object has the following properties:

| Properties       | Type              | Description                                                        |
| ---------------- | ----------------- | ------------------------------------------------------------------ |
| `requestContext` | <pre>object</pre> | [RequestContext](/core/2/framework/classes/request-context) object |
| `room`           | <pre>object</pre> | Left room information, see below                                   |

### room

The provided `room` object has the following properties:

| Properties   | Type              | Description            |
| ------------ | ----------------- | ---------------------- |
| `id`         | <pre>string</pre> | Room unique identifier |
| `index`      | <pre>string</pre> | Index                  |
| `collection` | <pre>string</pre> | Collection             |

</DeprecatedBadge>

---

## core:realtime:room:create:after

<SinceBadge version="2.5.0"/>

Triggered whenever a new realtime room is created on this node (NOT triggered if a user subscribes to an existing room).

:::info
Pipes cannot listen to this event, only hooks can.
:::

| Arguments | Type              | Description             |
| --------- | ----------------- | ----------------------- |
| `event`   | <pre>object</pre> | Created room, see below |

### event

The provided `event` object has the following properties:

| Properties | Type                | Description                                            |
| ---------- | ------------------- | ------------------------------------------------------ |
| `args`     | <pre>object[]</pre> | Its only item is the room normalized filter, see below |
| `response` | <pre>any</pre>      | Internal, do not use                                   |

The normalized filter (`event.args[0]`) has the following properties:

| Properties | Type                | Description                                                                                                 |
| ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`       | <pre>string</pre>   | The new room unique identifier                                                                              |
| `index`    | <pre>string</pre>   | Internal Koncorde index, built from the index and collection names                                          |
| `filter`   | <pre>object[]</pre> | Filters in [Koncorde's normalized format](https://www.npmjs.com/package/koncorde#filter-unique-identifier) |

::: info
The deprecated [room:new](#room-new) event provides the index name, the collection name and the room identifier directly.
:::

---

## core:realtime:room:remove:before

<SinceBadge version="2.5.0"/>

::: warning
This event is no longer triggered since Kuzzle 2.11.0.
:::

Was triggered whenever a realtime room is deleted, which happens when the last subscriber leaves it.

| Arguments | Type              | Description            |
| --------- | ----------------- | ---------------------- |
| `roomId`  | <pre>string</pre> | Room unique identifier |


---

## core:realtime:user:subscribe:after

Triggered whenever a user makes a new [subscription](/core/2/api/controllers/realtime/subscribe).

:::info
Pipes cannot listen to this event, only hooks can.
:::

<SinceBadge version="2.5.0"/>

| Arguments      | Type              | Description                                       |
| -------------- | ----------------- | ------------------------------------------------- |
| `subscription` | <pre>object</pre> | Contains information about the added subscription |


### subscription

The provided `subscription` object has the following properties:

| Properties     | Type               | Description                                                                                                |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `roomId`       | <pre>string</pre>  | Room unique identifier                                                                                     |
| `connectionId` | <pre>string</pre>  | [ClientConnection](/core/2/guides/write-protocols/context/clientconnection) unique identifier              |
| `index`        | <pre>string</pre>  | Index                                                                                                      |
| `collection`   | <pre>string</pre>  | Collection                                                                                                 |
| `filters`      | <pre>object</pre>  | Filters as sent by the user, in [Koncorde syntax](/core/2/api/koncorde-filters-syntax) (not normalized)   |
| `kuid`         | <pre>string</pre>  | ID of the user <SinceBadge version="2.14.1" />                                                             |

---

## core:realtime:user:unsubscribe:after

Triggered whenever a user leaves a room.

:::info
Pipes cannot listen to this event, only hooks can.
:::

<SinceBadge version="2.5.0"/>

| Arguments | Type              | Description                                |
| --------- | ----------------- | ------------------------------------------ |
| `payload` | <pre>object</pre> | Information about the left room, see below |

### payload

The provided `payload` object has the following properties:

| Properties       | Type              | Description                                                                                             |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `requestContext` | <pre>object</pre> | [RequestContext](/core/2/framework/classes/request-context) object <DeprecatedBadge version="2.14.1" /> |
| `room`           | <pre>object</pre> | Left room information <DeprecatedBadge version="2.14.1" />                                              |
| `subscription`   | <pre>object</pre> | Contains information about the removed subscription <SinceBadge version="2.14.1" />                     |

### room

The provided `room` object has the following properties:

| Properties   | Type              | Description            |
| ------------ | ----------------- | ---------------------- |
| `id`         | <pre>string</pre> | Room unique identifier |
| `index`      | <pre>string</pre> | Index                  |
| `collection` | <pre>string</pre> | Collection             |

### subscription

The provided `subscription` object has the following properties:

| Properties     | Type               | Description                                                                                   |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `roomId`       | <pre>string</pre>  | Room unique identifier                                                                        |
| `connectionId` | <pre>string</pre>  | [ClientConnection](/core/2/guides/write-protocols/context/clientconnection) unique identifier |
| `index`        | <pre>string</pre>  | Index                                                                                         |
| `collection`   | <pre>string</pre>  | Collection                                                                                    |
| `kuid`         | <pre>string</pre>  | ID of the user                                                                                |

---

## core:realtime:notification:dispatch:before

<SinceBadge version="2.19.3"/>

| Arguments             | Type              | Description                                 |
| --------------------- | ----------------- | ------------------------------------------- |
| `notificationContext` | <pre>object</pre> | Contains information about the notification |

### notificationContext

| Arguments      | Type                                                                    | Description                                                                                   |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `notification` | <pre><a href="/core/2/api/payloads/notifications">Notifications</a></pre> | The normalized real-time notification                                                         |
| `channels`     | <pre>string[]</pre>                                                     | List of Subscribers channels to notify                                                        |
| `connectionId` | <pre>string</pre>                                                       | [ClientConnection](/core/2/guides/write-protocols/context/clientconnection) unique identifier, or `null` when the notification is sent to every subscriber of the channels |

---

## notify:dispatch

<DeprecatedBadge version="2.19.3">

This event is deprecated and will be removed in the next major version of Kuzzle.

Use `core:realtime:notification:dispatch:before` instead.

| Arguments | Type                                                                    | Description                           |
| --------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `message` | <pre><a href=/core/2/api/payloads/notifications>Notifications</a></pre> | The normalized real-time notification |

Triggered whenever a real-time notification is about to be sent.

</DeprecatedBadge>

---

## notify:document

| Arguments | Type                                                                    | Description                           |
| --------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `message` | <pre><a href=/core/2/api/payloads/notifications>Notifications</a></pre> | The normalized real-time notification |

Triggered whenever a real-time document notification is about to be sent.

---

## notify:server

| Arguments | Type                                                                    | Description                           |
| --------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `message` | <pre><a href=/core/2/api/payloads/notifications>Notifications</a></pre> | The normalized real-time notification |

Triggered whenever a real-time server notification is about to be sent.

---

## notify:user

| Arguments | Type                                                                    | Description                           |
| --------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `message` | <pre><a href=/core/2/api/payloads/notifications>Notifications</a></pre> | The normalized real-time notification |

Triggered whenever a real-time user notification is about to be sent.

---

## room:new

This event is deprecated and will be removed in the next major version of Kuzzle.

Use `core:realtime:room:create:after` instead.

<DeprecatedBadge version="2.5.0">


| Arguments | Type              | Description             |
| --------- | ----------------- | ----------------------- |
| `room`    | <pre>object</pre> | Joined room information |

Triggered whenever a [subscription](/core/2/api/controllers/realtime/subscribe) creates a new room on this node (NOT triggered if a user subscribes to an existing room).

:::info
Pipes cannot listen to this event, only hooks can.
:::

### room

The provided `room` object has the following properties:

| Properties   | Type              | Description                    |
| ------------ | ----------------- | ------------------------------ |
| `index`      | <pre>string</pre> | Index name                     |
| `collection` | <pre>string</pre> | Collection name                |
| `roomId`     | <pre>string</pre> | The new room unique identifier |

</DeprecatedBadge>

---

## room:remove

This event is deprecated and will be removed in the next major version of Kuzzle.

It has no replacement: `core:realtime:room:remove:before` is no longer triggered since Kuzzle 2.11.0.

<DeprecatedBadge version="2.5.0">

| Arguments | Type              | Description            |
| --------- | ----------------- | ---------------------- |
| `roomId`  | <pre>string</pre> | Room unique identifier |

Triggered whenever a realtime room is deleted on this node, which happens when its last subscriber leaves it.

Errors thrown by pipes listening to this event are ignored.

</DeprecatedBadge>

---
