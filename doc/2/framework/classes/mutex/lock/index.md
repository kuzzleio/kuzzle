---
code: true
type: page
title: lock | Framework | Core

description: Mutex class lock() method
---

# lock

<SinceBadge version="2.9.0" />
<DeprecatedBadge version="2.57.0" />

::: warning
`Mutex` is deprecated since 2.57.0: use [withLock](/core/2/framework/functions/with-lock) instead. Both take the same Redis key, so a `Mutex` and a `withLock` call on the same resource exclude each other, and call sites can be migrated one at a time.
:::

Tries to lock a resource.

```ts
lock(): Promise<boolean>
```

<br/>

## Returns

Returns a promise, resolving to a boolean value.

If a `timeout` (see [constructor options](/core/2/framework/classes/mutex/constructor)) has been set with a number greater than or equal to 0, then you must check the boolean result to verify if the lock has been acquired or not.

If the lock timeout was set to `-1`, the promise will only be resolved once the lock has successfully been acquired, and the boolean result is always `true`.

Once the node is shutting down, the promise never resolves: the process is about to exit.

## Throws

Throws a [core.fatal.assertion_failed](/core/2/api/errors/error-codes/core#subdomain-0x0000-fatal) error if this mutex instance already holds the lock: a `Mutex` is not reentrant. Use another instance, or [withLock](/core/2/framework/functions/with-lock), which is.
