---
code: true
type: page
title: unlock | Framework | Core

description: Mutex class unlock() method
---

# unlock

<SinceBadge version="2.9.0" />
<DeprecatedBadge version="2.57.0" />

::: warning
`Mutex` is deprecated since 2.57.0: use [withLock](/core/2/framework/functions/with-lock) instead. Both take the same Redis key, so a `Mutex` and a `withLock` call on the same resource exclude each other, and call sites can be migrated one at a time.
:::

Frees the locked resource, making it available again.

```ts
unlock(): Promise<void>
```

<br/>

## Returns

Returns a promise, resolved once the mutex has been unlocked.

This method never throws.
