---
code: false
type: page
title: External Plugins
description: Use External Plugins to add whole sets of features
order: 400
---

# External Plugins

Kuzzle allows to add **whole set of features via plugins**.

Plugins are **intended to be reused** between several applications by proposing generic functionalities.

There are 2 categories of functionalities for plugins:
 - extension and modification of the API
 - integration of an authentication strategy

These feature categories are not exclusive and although it is not recommended, a plugin can embed features belonging to the 2 categories.

::: info
New network protocols can also be integrated to Kuzzle API by writting a [Protocol](/core/2/some-link).
::: 

## Inside a plugin

Plugins are classes that must implement the [Plugin](/core/2/some-link) interface.  

They can create new controllers or register pipes and hooks like applications.

::: info
The controllers registered by the plugins are prefixed by the plugin name in order to avoid any conflict.
:::

In addition to the standard features available in an application, plugins can also integrate [authentication strategies](/core/2/some-link).

::: info
More information about features available to plugins: [Write Plugins](/core/2/guides/write-plugins)
:::

## Use a plugin

Generally, plugins are distributed as NPM packages.  

It is possible to use the [Backend.plugin.use](/core/2/some-link) method to use a plugin in your application.  

::: info
Plugins must be used before starting the application.
:::

This method takes an instance of the plugin as a parameter:

```js
import PluginS3 from 'kuzzle-plugin-s3'

// [...]

app.plugin.use(new PluginS3())
```

It's possible to override the original plugin name by passing a new one in the option object:

```js
import PluginS3 from 'kuzzle-plugin-s3'

// [...]

app.plugin.use(new PluginS3(), { name: 'minio' })
```

::: info
Existing Kuzzle plugins can be found under the [kuzzle-plugin](https://github.com/topics/kuzzle-plugin) Github topic.
:::