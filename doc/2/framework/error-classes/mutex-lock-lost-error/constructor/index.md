---
code: true
type: page
title: Constructor | Framework | Core

description: MutexLockLostError class constructor
---

# MutexLockLostError

<SinceBadge version="2.57.0" />

Inherits from the standard JavaScript `Error` class (not from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor)).

[withLock](/core/2/framework/functions/with-lock) rejects with this error when the lock it holds is lost while its callback is still running, for instance because the lock's TTL could not be extended. Another node may then hold the lock.

The callback itself is not stopped: it keeps running in the background. Do not perform authoritative side effects once this error has been observed.

```ts
constructor(key: string, cause?: Error)
```

<br/>

| Argument | Type              | Description                                                       |
| -------- | ----------------- | ----------------------------------------------------------------- |
| `key`    | <pre>string</pre> | The lost lock's resource identifier                               |
| `cause`  | <pre>Error</pre>  | (optional) Why the lock was lost |
