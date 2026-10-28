---
type: page
code: false
title: Wildcard | Framework | Core

description: Wildcard events mechanism
order: 100
---

# Wildcard Events

Kuzzle allows you to listen to multiple events with a single listener thanks to wildcards (`*`).

Wildcards apply to every event whose name contains a `:` separator, not only to API events: the scope is everything before the last `:`. For instance, `core:realtime:user:subscribe:after` also triggers `core:realtime:user:subscribe:*`.

::: info
Wildcard events are triggered after standard events and more specific wildcards are triggered before more generic wildcards.  
Example: After document creation you will have `document:afterCreate` then `document:after*` and finally `document:*`
:::

---

## Name wildcard

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `*` | <pre>*</pre> | Depends on the event type |

You can catch all the events of a scope by using a wildcard instead of the event name. For API events, the scope is the controller name, so you catch all the actions of a controller.

### Naming Template

The event name is built using the following template:

`<scope>:*`

- `scope`: event scope, for API events the controller name

#### Example

```javascript
this.pipes = {
  // the listener function is executed every time an
  // event is triggered by the "document" controller
  'document:*': <function to call>
};
```

---

## Templated events wildcard

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Wildcards permit listening to templated events whose name starts with `before` or `after`.

### Naming Template

The event name is built using the following template:

`<scope>:<template>*`

- `scope`: event scope, for API events the controller name
- `template`: `before` or `after`

::: info
There is no `<scope>:error*` wildcard: to listen to every failed action of a controller, use `<controller>:*`, or listen to [request:onError](/core/2/framework/events/request#request-onerror).
:::

#### Example

```javascript
this.pipes = {
  // the listener function is executed after every successful
  // API action performed by the "document" controller
  'document:after*': <function to call>
};
```
