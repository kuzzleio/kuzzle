---
code: true
type: page
title: constructor | Framework | Core

description: Plugin class constructor() abstract method
---

# constructor

Constructor method of the `Plugin` abstract class. It must be called with a [PluginManifest](/core/2/framework/types/plugin-manifest).

## Arguments

```ts
constructor (manifest: PluginManifest);
```

<br/>

| Argument  | Type   | Description            |
| -------------- | --------- | ------------- |
| `manifest` | <pre>[PluginManifest](/core/2/framework/types/plugin-manifest)</pre> | [PluginManifest](/core/2/framework/types/plugin-manifest) instance |

The manifest contains the following properties:
 - `kuzzleVersion`: a non-empty string describing a [semver range](https://www.npmjs.com/package/semver#ranges), limiting the range of Kuzzle versions supported by this plugin. If not set, a warning is displayed on the console, and Kuzzle assumes that the plugin is only compatible with Kuzzle v2.x

## Usage

```ts
import { Plugin } from 'kuzzle';

class EmailPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8.0 <3' });
  }
}
```

