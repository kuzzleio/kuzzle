---
code: true
type: page
title: unlock
description: Mutex class unlock() method
---

# unlock

<SinceBadge version="auto-version" />

Frees the locked resource, making it available again.

```ts
unlock(): Promise<void>
```

<br/>

## Returns

Returns a promise, resolved once the mutex has been unlocked.

This method never throws.
