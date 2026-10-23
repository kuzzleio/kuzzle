---
code: true
type: page
title: withLock | Framework | Core

description: Run a function while holding a distributed, reentrant lock
---

# withLock

<SinceBadge version="2.57.0" />

Runs a function while holding a lock on a resource, across every node of the cluster (or within a single node).

It replaces the deprecated [Mutex](/core/2/framework/classes/mutex) class.

```ts
withLock<T>(key: string, callback: () => Promise<T>, config?: MutexConfig): Promise<T>
```

<br/>

| Argument   | Type                                                           | Description                                                                          |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `key`      | <pre>string</pre>                                              | Resource identifier to lock. It must be the same on every node for the same resource |
| `callback` | <pre>() => Promise&lt;T&gt;</pre>                              | Function to run once the lock is held                                                |
| `config`   | <pre>[MutexConfig](/core/2/framework/types/mutex-config)</pre> | (optional) Lock options: `retryAttempts`, `retryDelay` and `ttl`                     |

## Returns

Returns a promise that settles with the outcome of `callback`: it resolves to the value `callback` resolves to, or rejects with the error `callback` rejects with.

It also rejects with:

- [MutexAcquireError](/core/2/framework/error-classes/mutex-acquire-error) if the lock could not be acquired within `retryAttempts + 1` attempts. `callback` was not run.
- [MutexLockLostError](/core/2/framework/error-classes/mutex-lock-lost-error) if the lock is lost while `callback` is running (see [Lost lock](#lost-lock)).

---

## Behavior

### Acquisition

The lock is a key of Kuzzle's internal Redis cache, named `key`, taken with `SET NX`. The first attempt is made at once; while the key is held by someone else, up to `retryAttempts` more attempts are made, `retryDelay` milliseconds apart:

- with the defaults (`retryAttempts: 10`, `retryDelay: 200`), `withLock` gives up after 11 attempts, about 2 seconds;
- with `retryAttempts: 0`, a single attempt is made: the promise rejects at once if the resource is already locked;
- with `retryAttempts: Infinity`, `withLock` waits as long as it takes.

### While the lock is held

The lock is taken with a time to live (`ttl`, 30 seconds by default), which is extended in the background for as long as `callback` runs: `callback` may run longer than `ttl`. The TTL only matters when the node stops extending the lock, for instance because it crashed: the lock then expires on its own, at most `ttl` milliseconds later.

The lock is released as soon as `callback` settles, whether it resolves or rejects. A failed release is not reported: the key then expires with its TTL.

### Lost lock

If the lock cannot be extended (a Redis error, or the key expired and was taken by someone else), the returned promise rejects with `MutexLockLostError` as soon as this is detected, without waiting for `callback`. Its `cause` says why: the Redis error when the extension failed with one, otherwise the lock library's own lost-lock error.

`callback` cannot be cancelled: it keeps running in the background, while another node may now hold the lock. Do not perform authoritative side effects after the promise has rejected with this error.

### Reentrancy

The lock is reentrant within an async context: a `withLock` call on the same `key`, made from inside `callback` (directly, or from anything `callback` awaits), runs its own callback immediately, with no new Redis round-trip. Its `config` is ignored: the outer call's lock, TTL and retries apply.

Any other call on the same `key`, from another request or another node, waits for the lock.

### Compatibility with Mutex

The deprecated [Mutex](/core/2/framework/classes/mutex) class takes the same Redis key with `SET NX`. On the same `key`, a `Mutex` and a `withLock` call exclude each other, and neither can release the other's lock: call sites can be migrated one at a time.

### Shutdown

A node that shuts down releases the locks it holds before it exits, so that the other nodes do not wait for them to expire. From then on, a `withLock` call on that node never settles and never runs its callback.

::: info
`withLock` uses Kuzzle's internal cache. Call it once Kuzzle is running: from a plugin's `init` method onward, or in an application once `app.start()` has resolved.
:::

---

## Usage

Run a task on one node at a time:

```ts
import { withLock } from 'kuzzle';

async function rebuildReport () {
  return withLock('report:rebuild', async () => {
    // only one node runs this at any given time
  });
}
```

Refuse a task that is already running somewhere in the cluster:

```ts
import { MutexAcquireError, TooManyRequestsError, withLock } from 'kuzzle';

async function doNotRepeatProcess () {
  let started = false;

  try {
    return await withLock('uniqueTask', async () => {
      started = true;
      // ... do things
    }, { retryAttempts: 0 });
  }
  catch (error) {
    // `started`: an error thrown by the task itself is not a busy lock
    if (!started && error instanceof MutexAcquireError) {
      throw new TooManyRequestsError('That task is already ongoing');
    }

    throw error;
  }
}
```

Wait as long as it takes, for a task that may outlive the TTL:

```ts
import { withLock } from 'kuzzle';

await withLock('nightly:import', async () => {
  // the lock is extended for as long as this runs
}, { retryAttempts: Infinity });
```
