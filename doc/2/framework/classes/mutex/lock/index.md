---
code: true
type: page
title: lock | Framework | Core

description: Mutex class lock() method
---

# lock

<SinceBadge version="2.9.0" />

Tries to lock a resource.

```ts
lock(): Promise<boolean>
```

<br/>

## Returns

Returns a promise, resolving to a boolean value.

If a `timeout` (see [constructor options](framework/classes/mutex/constructor)) has been set with a number greater than or equal to 0, then you must check the boolean result to verify if the lock has been acquired or not.

If the lock timeout was set to `-1`, the promise will only be resolved once the lock has successfully been acquired, and the boolean result is always `true`.
