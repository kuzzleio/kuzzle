---
code: false
type: page
title: External Plugins
description: Use External Plugins to add whole sets of features
order: 500
---

# External Plugins

You can **extend Kuzzle's features** via plugins.

Plugins are **intended to be reused** between several applications by proposing generic features.

Plugins allow you to achieve two main goals:
 - extension and modification of the API
 - integration of an authentication strategy

These feature categories are not exclusive and although it is not recommended, a plugin can embed features belonging to the 2 categories.

::: info
New network protocols can also be integrated to Kuzzle API by writting a [Protocol](/core/2/guides/writing-protocols).
::: 

## Inside a plugin

Plugins are classes that must implement the [Plugin](/core/2/framework/abstract-classes/plugin) abstract class.  

They can create new controllers or register pipes and hooks like applications.

In addition to the standard features available in an application, plugins can also integrate [authentication strategies](/core/2/guides/write-plugins/3-integrate-authentication-strategy).

::: info
More information about features available to plugins: [Write Plugins](/core/2/guides/write-plugins)
:::

## Use a plugin

Generally, plugins are distributed as NPM packages.  

It is possible to use the [Backend.plugin.use](/core/2/framework/classes/backend-plugin/use) method to use a plugin in your application.  

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
Existing Kuzzle plugins may be found under the [kuzzle-plugin](https://github.com/topics/kuzzle-plugin) Github topic.
:::
