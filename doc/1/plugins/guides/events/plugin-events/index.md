---
type: page
code: false
title: Plugin Events
order: 200
---

# Plugin Events



Plugins can [add new controllers](/core/1/plugins/guides/controllers) to the Kuzzle API.

These new controllers and actions behave exactly like [native API actions](/core/1/plugins/guides/events/api-events/).
All calls to plugins API actions trigger two of these three events:

- before the action starts
- after it succeeds
- after it fails

---

## before

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | [`Request`](/core/1/plugins/constructors/request) | The normalized API request |

A `before` event is triggered before a plugin API request starts.

### Naming Template

The `before` event name is built using the following template:

`<plugin name>/<controller>:before<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/1/plugins/essentials/getting-started/#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                 |
| ----------- | -------------- | -------- | -------------------------------- |
| `plugin`    | `controller`   | `action` | `plugin/controller:beforeAction` |

---

## after

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | [`Request`](/core/1/plugins/constructors/request) | The normalized API request |

An `after` event is triggered after a plugin API request succeeds.

### Naming Template

The `after` event name is built using the following template:

`<plugin name>/<controller>:after<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/1/plugins/essentials/getting-started/#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                |
| ----------- | -------------- | -------- | ------------------------------- |
| `plugin`    | `controller`   | `action` | `plugin/controller:afterAction` |

---

## error

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | [`Request`](/core/1/plugins/constructors/request) | The normalized API request |

An `error` event is triggered after a plugin API request fails.

### Naming Template

The `error` event name is built using the following template:

`<plugin name>/<controller>:error<Action>`

- `plugin name`: the plugin's name defined in the [manifest file](/core/1/plugins/essentials/getting-started/#prerequisites)
- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| Plugin name | API controller | Action   | After event name                |
| ----------- | -------------- | -------- | ------------------------------- |
| `plugin`    | `controller`   | `action` | `plugin/controller:errorAction` |
