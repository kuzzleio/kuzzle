---
code: true
type: page
title: trigger
---

# trigger

Triggers a custom event.

This allows interactions with other plugins using [hooks](/core/2/plugins/guides/hooks) or [pipes](/core/2/plugins/guides/pipes).

::: info
If the event is listened by pipes, the result of the pipe chain will be returned in a promise.
This behavior can be used for a Remote Procedure Call (RPC) system between plugins.
:::

## Arguments

```js
trigger(event, [payload]);
```

<br/>

| Arguments | Type              | Description       |
| --------- | ----------------- | ----------------- |
| `event`   | <pre>string</pre> | Custom event name |
| `payload` | <pre>object</pre> | Event payload     |

**Note:** the triggered event is renamed using the following format:<br/>`plugin-<plugin name>:<event>`.

## Example

```js
// somewhere in the emitting plugin, named "emitting-plugin" in the manifest

const result = await context.accessors.trigger('sayHello', 'World');
// => "Hello, World"

// [...]

// Listening plugin
class ListeningPlugin {
  constructor() {
    this.pipes = {
      'plugin-emitting-plugin:sayHello': async name => {
        return `Hello, ${name}`;
      }
    };
  }
}
```
