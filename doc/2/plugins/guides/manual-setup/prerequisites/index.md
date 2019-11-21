---
code: false
type: page
title: Prerequisites
description: how to create a custom plugin
order: 0
---

# Prerequisites

## Location

Plugins are subdirectories that must be put at the following location: `<kuzzle_install_dir>/plugins/enabled`.

The recommended way to install a plugin is to put it in `plugins/available`, and then link it to the `plugins/enabled` directory.

## Node.js modules

Kuzzle loads plugins as [Node.js modules](https://nodejs.org/dist/latest-v8.x/docs/api/modules.html).

This means that a plugin directory must contain either:

- an `index.js` file

and/or:

- a valid [package.json](https://docs.npmjs.com/files/package.json) file. If the plugin's entrypoint is not the root `index.js` file, then the [main](https://docs.npmjs.com/files/package.json#main) property must be filled

## manifest.json

Kuzzle needs a few information to make your plugin work properly. These information must be provided in a `manifest.json` file, in the plugin directory.

The following properties can be defined in this `manifest.json` file:

- `name` (**required**): plugin unique identifier. Names can only contain letters, numbers, hyphens and underscores.
- `kuzzleVersion`: a non-empty string describing a [semver range](https://www.npmjs.com/package/semver#ranges), limiting the range of Kuzzle versions supported by this plugin. If not set, a warning is displayed on the console, and Kuzzle assumes that the plugin is only compatible with Kuzzle v2.x

