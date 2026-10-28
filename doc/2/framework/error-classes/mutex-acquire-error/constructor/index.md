---
code: true
type: page
title: Constructor | Framework | Core

description: MutexAcquireError class constructor
---

# MutexAcquireError

<SinceBadge version="2.60.0" />

Inherits from the standard JavaScript `Error` class (not from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor)).

[withLock](/core/2/framework/functions/with-lock) rejects with this error when it could not acquire the lock within its `retryAttempts + 1` attempts. The callback was not run.

Before 2.60.0, `withLock` rejected with a plain `Error` carrying the same message.

```ts
constructor(key: string, attempts: number)
```

<br/>

| Argument   | Type              | Description                               |
| ---------- | ----------------- | ----------------------------------------- |
| `key`      | <pre>string</pre> | The lock's resource identifier            |
| `attempts` | <pre>number</pre> | Number of acquisition attempts made       |
