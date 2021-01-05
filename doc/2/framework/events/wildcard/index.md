---
type: page
code: false
title: Wildcard
description: Wildcard events mechanism
order: 100
---

# Wildcard Events

Kuzzle allows you to listen to multiple events with a single listener thanks to wildcards (`*`).

::: info
Wildcard events are triggered after standard events and more specific wildcard are triggered before more generic wildcard.  
Example: After document creation you will have `document:afterCreate` then `document:after*` and finally `document:*`
:::

---

## Name wildcard

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `*` | `*` | Depends on the event type |

You can catch all the actions of a controller by using a wildcard instead of the action name.

### Naming Template

The event name is built using the following template:

`<controller>:*`

- `controller`: controller name

#### Example

```javascript
this.pipes = 
  // the listener function is executed every time an
  // event is triggered by the "document" controller
  'document:*': <function to call> 
};
```

---

## Templated events wildcard

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/plugins/1/constructors/request>KuzzleRequest</a></pre> | The normalized API request |

Wildcards permit listening templated events.

### Naming Template

The event name is built using the following template:

`<controller>:<template>*`

- `controller`: API controller name
- `template`: `before`, `after` or `error`

#### Example

```javascript
this.pipes = 
  // the listener function is executed after every successful
  // API action performed by the "document" controller
  'document:after*': <function to call>
};
```
