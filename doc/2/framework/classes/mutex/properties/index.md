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
| <pre>boolean</pre> | Indicates whether the resource is locked or not |


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

