---
type: page
code: false
title: Plugin Events
order: 200
---

# Plugin Events

# Error Events

## hook error

When a plugin's hook function returns a rejected promise or throws an error, the event `hook:onError` is emitted.  

Handlers attached to this event will receive the following arguments:

| Arguments    | Type     | Description                                   |
|--------------|----------|-----------------------------------------------|
| `pluginName` | `String` | Plugin name                                   |
| `event`      | `String` | Original event to which the hook was attached |
| `error`      | `Error`  | Error object                                  |

::: info
To prevent infinite loops, if a hook attached to the `hook:onError` event fails, it won't trigger any other events.
:::

### Example

Consider a plugin with the following hooks:

```js
this.hooks = {
  // Each errored hook will trigger this method
  'hook:onError': (pluginName, event, error) => {
    this.context.accessors.error(`${pluginName} hook on ${event} failed: ${error.message}`)
  },

  // Each call to document:create will trigger this method, throwing an error
  'document:beforeCreate': async request => {
    throw new Error('The cake is a lie');
  }   
};
```

# API Events

Plugins can [add new controllers](/core/2/plugins/guides/controllers) to the Kuzzle API.

These new controllers and actions behave exactly like [native API actions](/core/2/plugins/guides/events/api-events).
All calls to plugins API actions trigger two of these three events:

- before the action starts
- after it succeeds
- after it fails

---

## before

| Arguments | Type      | Description                                                                       |
|-----------|-----------|-----------------------------------------------------------------------------------|
| `request` | `Request` | The normalized API [request](/core/2/plugins/plugin-context/constructors/request) |

A `before` event is triggered before a plugin API request starts.

### Naming Template

The `before` event name is built using the following template:

`<plugin name>/<controller>:before<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/2/plugins/essentials/getting-started#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                 |
|-------------|----------------|----------|----------------------------------|
| `plugin`    | `controller`   | `action` | `plugin/controller:beforeAction` |

---

## after

| Arguments | Type      | Description                                                                       |
|-----------|-----------|-----------------------------------------------------------------------------------|
| `request` | `Request` | The normalized API [request](/core/2/plugins/plugin-context/constructors/request) |

An `after` event is triggered after a plugin API request succeeds.

### Naming Template

The `after` event name is built using the following template:

`<plugin name>/<controller>:after<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/2/plugins/essentials/getting-started#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                |
|-------------|----------------|----------|---------------------------------|
| `plugin`    | `controller`   | `action` | `plugin/controller:afterAction` |

---

## error

| Arguments | Type      | Description                                                                       |
|-----------|-----------|-----------------------------------------------------------------------------------|
| `request` | `Request` | The normalized API [request](/core/2/plugins/plugin-context/constructors/request) |

An `error` event is triggered after a plugin API request fails.

### Naming Template

The `error` event name is built using the following template:

`<plugin name>/<controller>:error<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/2/plugins/essentials/getting-started#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                |
|-------------|----------------|----------|---------------------------------|
| `plugin`    | `controller`   | `action` | `plugin/controller:errorAction` |
