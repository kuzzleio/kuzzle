---
type: page
code: false
title: Hook
description: Hook events list
order: 100
---

# Hook Error

When an application or plugin's hook function returns a rejected promise, the event `hook:onError` is emitted.  

Handlers attached to this event will receive the following arguments:

| Arguments    | Type     | Description                                   |
|--------------|----------|-----------------------------------------------|
| `pluginName` | <pre>String</pre> | Application or plugin name                    |
| `event`      | <pre>String</pre> | Original event to which the hook was attached |
| `error`      | <pre>Error</pre>  | Error object                                  |

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
