---
code: true
type: page
title: Mutex
---

# Mutex

<SinceBadge version="1.12.0" />

Instantiates a new mutex, that can be used to lock a resource. 

Allows to have a process played on only 1 node on a Kuzzle cluster, with the other ones waiting until the lock is freed.

Also works within a single node: in that case, it's better if lock attempts from different parts of the code use different Mutex instances (with the same lock ID).

---

## Constructor

```js
new context.constructors.Mutex(lockId, [options]);
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `lockId`            | <pre>string</pre> | Lock unique id (must be identical across all nodes)  |
| `options`           | <pre>object</pre> | (optional) Mutex options (see below) |

#### options

The `options` object is used to configure a mutex behavior. The following properties can be provided:

| Option         | Type              | Description                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `attemptDelay` | `Number`          | (default: 200) Delay in milliseconds between lock attempts |
| `timeout`      | `Number`          | (default: -1) Mutex lock acquisition timeout, in milliseconds. If set to 0, locking will return immediately, whether it can or cannot lock within the 1st attempt. If set to -1, the mutex will try to acquire the resource indefinitely |
| `ttl`          | `Number`          | (default: 5000) Lock time to live, in milliseconds. Locks will always be freed after that delay has expired. |

---

## lock

Locks the resource.

Returns a promise, resolving to a boolean value.

If a `timeout` (see constructor options) has been set with a number greather than or equal to 0, then you MUST check the boolean result to verify if the lock has been acquired or not.

If the lock timeout was set to `-1`, the promise will only be resolved once the lock was successfully acquired, and the boolean result is always `true`.


### Arguments

This function takes no argument.

```js
lock();
```

### Return

The `lock` function resolves to a boolean telling whether the lock was acquired or not.

---

## unlock

Frees the locked resource, making it available.


### Arguments

This function takes no argument.

```js
unlock();
```


### Return

Returns a promise, resolved once the mutex has been unlocked.

---
