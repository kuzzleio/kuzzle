---
type: page
code: false
title: API
description: API events list
order: 100
---

# API Events

All API actions, without exception, trigger two of these three events:

- before the action starts
- after it succeeds
- after it fails

---

## before

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

A `before` event is triggered before an API request starts.

### Naming Template

The `before` event name is built using the following template:

`<controller>:before<Action>`

- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| API action                                                                                   | After event name                 |
| -------------------------------------------------------------------------------------------- | -------------------------------- |
| [auth:login](/core/2/api/controllers/auth/login)                               | `auth:beforeLogin`               |
| [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) | `document:beforeCreateOrReplace` |

---

## after

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

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
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

An `error` event is triggered after an API request fails.

### Naming Template

The `error` event name is built using the following template:

`<controller>:error<Action>`

- `controller`: API controller name
- `Action`: controller action, camel cased

#### Example

| API action                                                                                   | After event name                |
| -------------------------------------------------------------------------------------------- | ------------------------------- |
| [auth:login](/core/2/api/controllers/auth/login)                               | `auth:errorLogin`               |
| [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) | `document:errorCreateOrReplace` |
