---
code: false
type: page
title: wait | Framework | Core

description: Mutex class wait() method
---

# wait

<SinceBadge version="2.19.1"/>
<DeprecatedBadge version="2.57.0" />

::: warning
`Mutex` is deprecated since 2.57.0: use [withLock](/core/2/framework/functions/with-lock) instead. Both take the same Redis key, so a `Mutex` and a `withLock` call on the same resource exclude each other, and call sites can be migrated one at a time.
:::

`withLock` has no `wait` counterpart: have every node run the initialization under `withLock`, and skip it when it finds the work already done.

```ts
wait(options: { attemptDelay?: number, timeout?: number }): Promise<boolean>
```

Waits for the resource to be unlocked, without locking it.

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `options`           | <pre>object</pre> | Mutex override options (see below). The object is required: pass `{}` to keep the mutex settings |

### options

The `options` object is used to override some mutex properties for this function. The following properties can be provided:

| Option         | Type              | Description                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `attemptDelay` | <pre>number</pre>          | (default: `this.attemptDelay`) Delay in milliseconds between two checks of the resource |
| `timeout`      | <pre>number</pre>          | (default: `this.timeout`) Wait timeout, in milliseconds. If set to 0, the resource is checked once. If set to -1, the mutex waits for the resource to be free indefinitely |

<br/>

## Returns

Returns a promise, resolving to `true` if the resource was unlocked before the `timeout`, and `false` otherwise.

---

## Usage

Initializing a shared resource once, while the other nodes wait for it to be ready:

```ts
import { Mutex } from 'kuzzle';

async function initSharedStuff () {
  const mutex = new Mutex('initSharedStuff', { timeout: 0 });

  if (await mutex.lock()) {
    try {
      // Initialize shared stuff
    }
    finally {
      await mutex.unlock();
    }
  }
  else {
    // Wait for shared stuff to be initialized
    await mutex.wait({ timeout: -1 });
  }
}
```
