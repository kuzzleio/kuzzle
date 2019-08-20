---
code: false
type: page
title: init function
description: how to create a custom plugin
order: 2
---

# init function

Plugins must expose an `init` function. If it is missing, Kuzzle fails to load the plugin and aborts its start sequence.

The `init` method is called once during startup, and it is used to initialize the plugin.

## Arguments

```js
init(config, context);
```

<br/>

| Arguments | Type              | Description                                                                                                                                                             |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`  | <pre>object</pre> | Contains the custom plugin configuration (see the [configuration](#configuration) chapter)                                                                      |
| `context` | <pre>object</pre> | The plugin context, exposing various accessors, constructors, and helpers. The other sections of this documentation detail the interfaces made available by this object |

## Return

The `init` function can optionally return a promise. If it does, Kuzzle waits for the promise to be resolved before continuing its own initialization.

If a promise is returned, it must be resolved within the configured timeout (see `plugins.common.initTimeout` in Kuzzle's [configuration](/core/2/guides/essentials/configuration))

If a promise is returned and rejected, or if the `init` function throws an error, Kuzzle aborts its start sequence and shuts down.
