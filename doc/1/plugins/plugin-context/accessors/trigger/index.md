---
code: true
type: page
title: trigger
---

# trigger



Triggers a custom event.

This allows interactions with other plugins using [hooks](/core/1/plugins/guides/hooks/) or [pipes](/core/1/plugins/guides/pipes/).

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
// Emitting plugin, named "some-plugin"
context.accessors.trigger('someEvent', {
  someAttribute: 'someValue'
});

// Listening plugin
class ListeningPlugin {
  constructor() {
    this.hooks = {
      'plugin-some-plugin:someEvent': 'someEventListener'
    };
  }

  someEventListener(payload) {
    this.doSomething(payload);
  }
}
```
