---
code: false
type: page
title: Debugging
description: Debug Kuzzle
order: 100
---

## Introduction

Kuzzle gives the possibility to debug a Kuzzle instance using the [Debug Controller](/core/2/api/controllers/debug) actions.

The Debug Controller gives you the ability to execute methods and listen to events from the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) or [Debug Modules](#debug-modules).

:::warn
By default access to the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) through the [Debug Controller](/core/2/api/controllers/debug) is disabled, to use the methods of the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) you need to enable it in the [kuzzlerc file](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample)
at `security.debug.native_debug_protocol` and reboot your instance.

[Debug Modules](#debug-modules) are still accessible when `security.debug.native_debug_protocol` is disabled.
:::

## Debug Modules

Debug Modules are modules of Kuzzle that are exposed through the [Debug Controller](/core/2/api/controllers/debug) actions and allows you to better understance what is happening on your instance and helps you debug you instance live.

Debug Modules have nothing to do with the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) and are perfectly safe whereas [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) could be used to execute code remotely which is why access to the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) is disabled by default in the config.