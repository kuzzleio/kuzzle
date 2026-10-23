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

```js
async wait ({ attemptDelay = this.attemptDelay, timeout = this.timeout }): Promise<boolean> {
```

Wait for the ressource specified in the promise to be unlocked. 

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `options`           | <pre>object</pre> | (optional) Mutex override options (see below) |

### options

The `options` object is used to override some mutex properties for this function. The following properties can be provided:

| Option         | Type              | Description                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `attemptDelay` | <pre>number</pre>          | (default: `this.attemptDelay`) Delay in milliseconds between resource check attempts |
| `timeout`      | <pre>number</pre>          | (default: `this.timeout`) Mutex check attempt timeout, in milliseconds. If set to 0, wait will return immediately, whether it the resource is locked within the 1st attempt. If set to -1, the mutex will wait for the resource to be free indefinitely |

<br/>

## Returns

True if the ressource has been unlocked before the `timeout`

---

## Usage

Waiting indefinitely until a resource is available:

```ts
import { Mutex } from 'kuzzle';

async function ConcurrentAccessMethod () {
  const mutex = new Mutex(
    'concurrentAccessMethodResource', { timeout: 0 });

  if (await mutex.lock())) {
      try {
        // Initialize shared stuff
      }
      finally {
        await mutex.unlock();
      }
    }
  }
  else {
    mutex.wait({ timeout: -1 });   // Wait for shared stuff to be initialized
  }
}
```
