---
code: true
type: page
title: trigger | Framework | Core

description: PluginContextAccessors class trigger() method
---

# trigger

Triggers a custom event.

This allows interactions with others plugins using [hooks](/core/2/guides/write-plugins/plugins-features#pipes-and-hooks) or [pipes](/core/2/guides/write-plugins/plugins-features#pipes-and-hooks).

::: info
If the event is listened by pipes, the result of the pipe chain will be returned in a promise.
If there is no listener, the result will be the same payload.
This behavior can be used for a Remote Procedure Call (RPC) system between plugins.
:::

## Arguments

```ts
trigger(eventName: string, ...any): Promise<any>;
```

<br/>

| Arguments | Type              | Description       |
| --------- | ----------------- | ----------------- |
| `event`   | <pre>string</pre> | Custom event name |
| `payload` | <pre>object</pre> | Event payload     |

**Note:** the triggered event is renamed by the following format:<br/>`plugin-<plugin name>:<event>`.

## Returns

Returns a promise resolving to the pipe chain result.

## Usage

```ts
await context.accessors.trigger('eventSayHello', 'World');
```
