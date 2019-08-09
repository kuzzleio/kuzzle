---
type: page
code: false
title: Introduction
order: 0
---

# Introduction

Whenever a plugin returns, rejects or throws an error, Kuzzle intercepts it and, by default, rethrows it as a [PluginImplementationError](/core/2/plugins/plugin-context/errors/pluginimplementationerror) error.

To prevent this, plugins have error constructors at their disposal. Plugins can also create their own errors by inheriting from the abstract [KuzzleError](/core/2/plugins/plugin-context/errors/kuzzleerror) object.

This section details the error constructors made available in the plugin context, an object containing a set of constructors, accessors and various other helpers, allowing plugins to interact with Kuzzle.

Each plugin receives its own context instance, provided to the plugin's [init function](/core/2/plugins/essentials/getting-started#init-function).
