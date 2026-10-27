---
code: false
type: page
title: Properties | Framework | Core

description: Mutex class properties
---

# Properties

<SinceBadge version="2.9.0" />
<DeprecatedBadge version="2.57.0" />

::: warning
`Mutex` is deprecated since 2.57.0: use [withLock](/core/2/framework/functions/with-lock) instead. Both take the same Redis key, so a `Mutex` and a `withLock` call on the same resource exclude each other, and call sites can be migrated one at a time.
:::

## `attemptDelay`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>number (readonly)</pre> | Delay in milliseconds between lock attempts |


## `locked`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>boolean (readonly)</pre> | Indicates whether this mutex instance holds the lock |


## `mutexId`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>string (readonly)</pre> | Unique identifier of this mutex instance (`<node id>/<random hex string>`). It is the value stored in the lock, so that only this instance can free it |

## `resource`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>string (readonly)</pre> | The name of the resource to be locked |

## `timeout`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>number (readonly)</pre> | Lock attempt timeout    |

## `ttl`

| Type               | Description                       |
|--------------------|-----------------------------------|
| <pre>number (readonly)</pre> | Time to live of a lock  |

