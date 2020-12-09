---
code: false
type: page
title: Hooks
order: 200
---

<DeprecatedBadge version="2.8.0" />

::: warning
This guide should be considered as obsolete and features presented here could be deprecated.
:::

# Hooks

Hooks are asynchronous listeners, plugged to [events](/core/2/guides/develop-on-kuzzle/event-system), and receiving information regarding that event.

Hooks can only listen: the received information cannot be changed. And Kuzzle doesn't wait for their execution either, so hooks cannot change the outcome of whatever triggered the listened event.

---

## Usage

Plugins can register hooks by exposing a `hooks` object: keys are listened [events](/core/2/guides/develop-on-kuzzle/event-system), and values are either a function to execute whenever that event is triggered, or an array of functions.

```js
this.hooks = {
  '<kuzzle event to listen>': <function to call>,
  '<another event>': [list, of, functions, to call]
};
```

---

## Example

```js
module.exports = class HookPlugin {
  constructor() {}

  /*
   Required plugin initialization function
   (see the "Plugin prerequisites" section)
   */
  init(customConfig, context) {
    /*
      Calls the plugin functions when the Kuzzle events
      are
     */
    this.hooks = {
      'document:afterCreate': this.myFunctionOnCreate.bind(this)
    };
  }

  /*
  Called whenever the "document:afterCreate" event
  is triggered
  */
  myFunctionOnCreate(request, event) {
    console.log(`Event ${event} triggered`);
    console.log(`Document created: ${request.result._id}`);
  }
};
```
