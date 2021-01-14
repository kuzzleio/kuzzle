---
code: false
type: page
title: Properties
description: Mutex class properties
---

# Properties

<SinceBadge version="auto-version" />

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

