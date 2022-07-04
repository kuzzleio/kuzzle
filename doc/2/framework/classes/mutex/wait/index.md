---
code: false
type: page
title: wait
description: Mutex class wait() method
---

# wait

<SinceBadge version="auto-version"/>

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
