---
code: false
type: page
title: Start Writing a Plugin
description: Setup environment for plugin development
order: 100
---

# Start Writing a Plugin

A plugin is a class inheriting from the [Plugin](/core/2/framework/abstract-classes/plugin) class.

This class must:
 - call the parent constructor with its [PluginManifest](/core/2/framework/types/plugin-manifest)
 - implements the [init](/core/2/framework/abstract-classes/plugin/init) method

You can use Kourou to initialize your development environment: `kourou app:scaffold`.

Then edit the `package.json` file to move the `kuzzle` package from the `dependencies` to the `devDependencies`.

You must also add `kuzzle` in the `peerDependencies` of the `package.json`.

## init method

The plugin must implement the method [init](/core/2/framework/abstract-classes/plugin/init).

This method will receive the configuration of the plugin as well as its context in parameters.

In order to be able to interact with the features of Kuzzle, it is necessary to save the context.

```ts
import { Plugin } from 'kuzzle';

export class MyPlugin extends Plugin {
  async init (config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;
  }
}
```

## Configuration

When Kuzzle calls the plugin `init` method, it passes the plugin's custom configuration to it.

Custom configuration parameters are specified for each plugin in the `plugins` object of the Kuzzle [configuration](/core/2/guides/advanced/8-configuration).

For example:

```json
{
  "plugins": {
    "foobar-plugin": {
      "option_1": "option_value",
      "option_2": "option_value"
    }
  }
}
```

## Plugin loaded from the filesystem

<DeprecatedBadge version="change-me">

Plugins are subdirectories that must be put at the following location: `<kuzzle_install_dir>/plugins/enabled`.

The recommended way to install a plugin is to put it in `plugins/available`, and then link it to the `plugins/enabled` directory.

### Node.js modules

Kuzzle loads plugins as [Node.js modules](https://nodejs.org/dist/latest-v8.x/docs/api/modules.html).

This means that a plugin directory must contain either:

- an `index.js` file

and/or:

- a valid [package.json](https://docs.npmjs.com/files/package.json) file. If the plugin's entrypoint is not the root `index.js` file, then the [main](https://docs.npmjs.com/files/package.json#main) property must be filled

### manifest.json

Kuzzle needs a few information to make your plugin work properly. These information must be provided in a `manifest.json` file, in the plugin directory.

The following properties can be defined in this `manifest.json` file:

- `name` (**required**): plugin unique identifier. Names can only contain letters, numbers, hyphens and underscores.
- `kuzzleVersion`: a non-empty string describing a [semver range](https://www.npmjs.com/package/semver#ranges), limiting the range of Kuzzle versions supported by this plugin. If not set, a warning is displayed on the console, and Kuzzle assumes that the plugin is only compatible with Kuzzle v2.x

</DeprecatedBadge>
