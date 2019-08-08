---
code: false
type: page
title: Getting started
description: how to create a custom plugin
order: 1
---

# Getting started

The best way to start developing a plugin is to use a boilerplate.

We provide a boilerplate that contain a Kuzzle stack that reloads itself whenever a plugin change is detected, making it a handy tool for plugin development.

- [kuzzle-core-plugin-boilerplate](https://github.com/kuzzleio/kuzzle-core-plugin-boilerplate)

Clone this repository to start developing a Kuzzle plugin:

```bash
git clone https://github.com/kuzzleio/kuzzle-core-plugin-boilerplate
cd kuzzle-core-plugin-boilerplate
docker-compose -f docker/docker-compose.yml up
// Kuzzle stack with the plugin is ready
// Edit the file lib/index.js,
// the Kuzzle stack will automaticaly restart to include your modifications
```

The provided `docker-compose.yml` file launches a Kuzzle stack with the `pm2` module, with the following features:

- Automated Kuzzle restart every time a change is detected in the plugin code
- Configurable through the parameters set in that `pm2.json` file

The main Plugin class is defined in the `index.js`. You can start edit it adding:

- [Hooks](/core/1/plugins/guides/hooks/)
- [Pipes](/core/1/plugins/guides/pipes/)
- [Controllers](/core/1/plugins/guides/controllers/)
- [Authentication Strategies](/core/1/plugins/guides/strategies/overview/)

We need to provide the `configuration` and the `context` to plugins. In that purpose, plugins must have an `init` function which will have them as parameters : this `init` function is the very first one to be called by Kuzzle and is mandatory to start a plugin. You can now write your own functions and your own routes as described inside the `index.js`. You can also write unit tests : see `steps.js`.

:::info
You can find more information about the `init` function [here](/core/1/plugins/guides/manual-setup/init-function/).
:::

:::success
You have now everything you need to start writing your own Kuzzle plugin.
:::
