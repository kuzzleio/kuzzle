---
type: page
code: false
title: API | Framework | Core

description: API events list
order: 100
---

# API Events

Executed API actions trigger two of these three events:

- before the action starts
- after it succeeds
- after it fails

::: info
Requests rejected before reaching their action (failed rights check, rate limit, overload protection) trigger none of these events. See [request:afterExecution](/core/2/framework/events/request#request-afterexecution) to observe every request.

Requests executed with the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) only trigger these events when the [triggerEvents](/core/2/guides/develop-on-kuzzle/event-system#trigger-events) option is set.
:::

::: info
For the `memoryStorage` controller, event names use the `ms` prefix instead of the controller name: for instance, `ms:beforeGet` and `ms:afterGet`.
:::

---

## before

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

A `before` event is triggered before an API request starts.

### Naming Template

The `before` event name is built using the following template:

`<controller>:before<Action>`

- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| API action                                                                                   | Before event name                 |
| -------------------------------------------------------------------------------------------- | -------------------------------- |
| [auth:login](/core/2/api/controllers/auth/login)                               | `auth:beforeLogin`               |
| [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) | `document:beforeCreateOrReplace` |

---

## after

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

An `after` event is triggered after an API request succeeds.

### Naming Template

The `after` event name is built using the following template:

`<controller>:after<Action>`

- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| API action                                                                                   | After event name                |
| -------------------------------------------------------------------------------------------- | ------------------------------- |
| [auth:login](/core/2/api/controllers/auth/login)                               | `auth:afterLogin`               |
| [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) | `document:afterCreateOrReplace` |

---

## error

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

An `error` event is triggered after an API request fails.

### Naming Template

The `error` event name is built using the following template:

`<controller>:error<Action>`

- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| API action                                                                                   | Error event name                |
| -------------------------------------------------------------------------------------------- | ------------------------------- |
| [auth:login](/core/2/api/controllers/auth/login)                               | `auth:errorLogin`               |
| [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) | `document:errorCreateOrReplace` |
