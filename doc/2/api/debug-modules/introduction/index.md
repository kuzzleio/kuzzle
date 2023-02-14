---
code: false
type: page
title: Introduction
description: Debug Modules introduction
order: 100
---

# Debug Modules

Debug Modules are modules that extends the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) capabilities
used with the [Debug Controller](/core/2/api/controllers/debug).

Each methods of a Debug Module can be called using the [debug:post](/core/2/api/controllers/debug/post) API action.
Each events of a Debug Module can be listened to using the [debug:addListener](/core/2/api/controllers/debug/add-listener) and [debug:removeListener](/core/2/api/controllers/debug/remove-listener) API action.

:::warning
Each methods or events of a Debug Module are using a specific format (`Kuzzle.<module name>.<method or event>`) when used with
[debug:post](/core/2/api/controllers/debug/post), [debug:addListener](/core/2/api/controllers/debug/add-listener) and [debug:removeListener](/core/2/api/controllers/debug/remove-listener).
This is meant to be easier to differentiate calls to [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) from calls to Kuzzle Debug Modules.
:::

## List of Debug Modules

| Debug Module                                 | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [Cluster](/core/2/api/debug-modules/cluster-debug-module) | Helps debug the nodes and state of the Cluster. |