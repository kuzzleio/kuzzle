---
code: false
type: page
title: Pipes
order: 300
---

<DeprecatedBadge version="change-me" />

::: warning
This guide should be considered as obsolete and features presented here could be deprecated.
:::

# Pipes

Pipes are functions plugged to [events](/core/2/guides/develop-on-kuzzle/3-event-system), called synchronously by Kuzzle, and receiving information regarding that event.

Pipes can:

- Decide to abort a task. If a pipe throws an error, Kuzzle interrupts the task, and forwards a standardized version of the thrown error to the originating user
- Change the received information. Kuzzle will use the updated information upon resuming the task

<DeprecatedBadge version="2.2.0"/>
Before Kuzzle 2.2.0, if a pipe takes too long to respond, Kuzzle will eventually abort the user request with a [GatewayTimeout](/core/2/api/errors/types) error. 

Note that while Kuzzle respond early with a Timeout error to users, the pipe task is still continuing.

The timeout value can be changed in the [configuration files](/core/2/guides/advanced/8-configuration).
</DeprecatedBadge>

---

## Usage

Plugins can register pipes by exposing a `pipes` object: keys are listened [events](/core/2/guides/develop-on-kuzzle/3-event-system), and values are either a function to execute whenever that event is triggered, or an array of functions.

```js
this.pipes = {
  '<kuzzle event to listen>': <function to call>,
  '<another event>': [list, of, functions, to call]
};
```

If multiple pipes are plugged to the same event (either from the same plugin or from multiple ones), they are executed sequentially, in no particular order, each pipe receiving updated information from their predecessors.

Pipes must notify Kuzzle about their completion by one of these two means:

- by calling the `callback(error, request)` function received as their last argument (leave the `error` null if the pipe executed successfully)
- by returning a promise, resolved (or rejected) with a valid [Request](/core/2/guides/main-concepts/api) upon the completion of the pipe

:::warning
You must either call the callback with a valid [Request](/core/2/guides/main-concepts/api) or return a promise resolving to one.
:::

If a pipe throws an error, it is advised to throw one of the available [KuzzleError](/core/2/api/errors/types) object. Otherwise, Kuzzle will reject the task with a `PluginImplementationError` error.

---

## Example

```js
module.exports = class PipePlugin {
  constructor() {}

  /*
    Required plugin initialization function
    (see the "Plugin prerequisites" section)
   */
  init(customConfig, context) {
    /*
      Attaches the plugin function "restrictUser" to the Kuzzle event
      "document:afterGet"
     */
    this.pipes = {
      'document:afterGet': this.restrictUser.bind(this)
    };
  }

  // Restrict document access to creator with callback
  restrictUser(request, callback) {
    if (
      request.context.user._id !== request.result._source._kuzzle_info.author
    ) {
      callback(new this.context.errors.NotFoundError(), null);
      return;
    }

    callback(null, request);
  }

  // Restrict document access to creator with async method
  async restrictUser(request) {
    if (
      request.context.user._id !== request.result._source._kuzzle_info.author
    ) {
      throw new this.context.errors.NotFoundError();
    }

    // You must return the original request if there is no error
    return request;
  }

  // Restrict document access to creator with traditional promises
  restrictUser(request) {
    if (
      request.context.user._id !== request.result._source._kuzzle_info.author
    ) {
      return Promise.reject(new this.context.errors.NotFoundError());
    }

    // You must return a promise resolving to the original request if there is no error
    return Promise.resolve(request);
  }
};
```
