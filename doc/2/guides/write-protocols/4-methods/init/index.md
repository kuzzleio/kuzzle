---
code: true
type: page
title: init
---

# init

Initializes the protocol.

Called once, during Kuzzle startup.

---

## Arguments

```js
init(entryPoint, context);
```

<br/>

| Arguments    | Type                                                           | Description                                                                              |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `entryPoint` | [`EntryPoint`](/core/2/protocols/api/entrypoint) | Provides an interface to protocol related methods                                        |
| `context`    | [`context`](/core/2/guides/write-protocols/2-context)       | Generic interface exposing objects and methods not directly related to the network layer |

---

## Return

The `init` function can optionally return a promise. If it does, Kuzzle waits for the promise to be resolved before continuing its own initialization.

If a promise is returned, it must be resolved within the configured timeout (see `services.common.defaultInitTimeout` in Kuzzle's [configuration](/core/2/guides/advanced/8-configuration))

If a promise is returned and rejected, or if the `init` function throws an error, Kuzzle aborts its start sequence and shuts down.
