---
code: true
type: page
title: init
description: Plugin class init() abstract method
---

# init (abstract)

Plugins must expose an `init` function. If it is missing, Kuzzle fails to load the plugin and aborts its start sequence.

The `init` method is called once during startup, and it is used to initialize the plugin.

## Arguments

```js
init(config: JSONObject, context: PluginContext);
```

<br/>

| Arguments | Type              | Description                                                                                                                                                             |
|-----------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `config`  | <pre>JSONObject</pre> | Contains the custom plugin configuration                                                                              |
| `context` | <pre>PluginContext</pre> | The plugin context, exposing various accessors, constructors, and helpers. The other sections of this documentation detail the interfaces made available by this object |

## Return

The `init` function can optionally return a promise. If it does, Kuzzle waits for the promise to be resolved before continuing its own initialization.

If a promise is returned, it must be resolved within the configured timeout (see `plugins.common.initTimeout` in Kuzzle's [configuration](/core/2/guides/advanced/8-configuration))

If a promise is returned and rejected, or if the `init` function throws an error, Kuzzle aborts its start sequence and shuts down.
