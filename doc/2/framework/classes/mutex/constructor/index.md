---
code: false
type: page
title: Constructor | Framework | Core

description: Mutex class constructor
---

# Mutex

<SinceBadge version="2.9.0" />
<DeprecatedBadge version="2.57.0" />

::: warning
`Mutex` is deprecated since 2.57.0: use [withLock](/core/2/framework/functions/with-lock) instead. Both take the same Redis key, so a `Mutex` and a `withLock` call on the same resource exclude each other, and call sites can be migrated one at a time.
:::

Instantiates a new mutex, allowing to lock a resource.  
Works both with single-node and cluster environments.

---

## Constructor

```js
new Mutex(resource, [options]);
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `resource`          | <pre>string</pre> | Resource identifier to be locked (must be identical across all nodes for the same resource)  |
| `options`           | <pre>object</pre> | (optional) Mutex options (see below) |

#### options

The `options` object is used to configure the mutex behavior. The following properties can be provided:

| Option         | Type              | Description                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `attemptDelay` | <pre>number</pre>          | (default: 200) Delay in milliseconds between lock attempts |
| `timeout`      | <pre>number</pre>          | (default: -1) Mutex lock acquisition timeout, in milliseconds. If set to 0, locking will return immediately, whether it can or cannot lock within the 1st attempt. If set to -1, the mutex will try to acquire the resource indefinitely |
| `ttl`          | <pre>number</pre>          | (default: 5000) Lock time to live, in milliseconds. Locks are freed when `unlock` is invoked, or after that delay has expired. |

---

## Usage

Waiting indefinitely until a resource is available:

```ts
import { Mutex } from 'kuzzle';

async function ConcurrentAccessMethod () {
  const mutex = new Mutex('concurrentAccessMethodResource');

  await mutex.lock();

  try {
    // safe zone: will only be executed once the resource is locked
  }
  finally {
    await mutex.unlock();
  }
}
```

Making sure that at most 1 task is executed at any given time in a cluster environment:

```ts
import { Mutex, TooManyRequestsError } from 'kuzzle';

async function DoNotRepeatProcess () {
  const mutex = new Mutex('uniqueTask', { timeout: 0 });

  const locked = await mutex.lock();

  if (!locked) {
    throw TooManyRequestsError('That task is already ongoing');
  }

  try {
    // ... do things
  }
  finally {
    await mutex.unlock();
  }
}
```

---

## Migrating to withLock

[withLock](/core/2/framework/functions/with-lock) runs a callback under the lock and releases it when the callback settles: there is no `lock` / `unlock` pair to keep balanced.

| `Mutex`                                   | `withLock`                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `timeout: -1` (default): wait indefinitely | `retryAttempts: Infinity` (the default is 10 retries, `retryDelay` 200 ms apart)                       |
| `timeout: 0`: `lock()` resolves to `false` | `retryAttempts: 0`: rejects with [MutexAcquireError](/core/2/framework/error-classes/mutex-acquire-error) |
| `timeout: n` (milliseconds)               | `retryAttempts` set to about `n / retryDelay`                                                          |
| `attemptDelay`                            | `retryDelay`                                                                                           |
| `ttl` (default 5000), never extended      | `ttl` (default 30000), extended while the callback runs                                                |

The first example above becomes:

```ts
import { withLock } from 'kuzzle';

async function ConcurrentAccessMethod () {
  await withLock('concurrentAccessMethodResource', async () => {
    // safe zone: will only be executed once the resource is locked
  }, { retryAttempts: Infinity });
}
```
