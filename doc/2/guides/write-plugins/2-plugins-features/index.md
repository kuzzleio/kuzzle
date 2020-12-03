---
code: false
type: page
title: Plugins Features
description: Available features in plugins development
order: 200
---

# Plugins Features

## Embedded SDK

Plugins have access to an instance of the [EmbeddedSDK](/core/2/guides/develop-on-kuzzle/1-embedded-sdk) to interact with Kuzzle throught the [Plugin.context.accessors.sdk](/core/2/framework/classes/plugin-context-accessors/properties#sdk) property.

## API

Plugins can declare new controllers and actions through the [Plugin.api](/core/2/framework/abstract-classes/plugin/properties#api) property.

::: info
API definition must be done in the constructor or in the plugin [init](doc/2/guides/write-plugins/1-start-writing-plugins#init-method) method.
:::

The `PluginApiDefinition` is an object which each key is a controller name and each value is a [ControllerDefinition](/core/2/framework/types/controller-definition)

```ts
class EmailPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8 <3' })

    this.api = {
      greeting: {
        actions: {
          sayHello: {
            handler: async request => `Hello, ${request.input.args.name}`
          }
        }
      }
    }
  }
}
```
::: warning
Plugin controller names will be prefixed by the plugin name.

With the example above, the controller name will be `email/greeting`
:::

Like standard API actions, plugin custom API action will also trigger [events](/core/2/framework/events/plugin).

See also the [API Controllers](/core/2/guides/develop-on-kuzzle/2-api-controllers) guide.


## Pipes and Hooks

Plugins can register hooks and pipes on the [Event System](/core/2/guides/develop-on-kuzzle/3-event-system).

::: info
Hooks and pipes registration must be done in the constructor or in the plugin [init](/core/2/guides/write-plugins/1-start-writing-plugins#init-method) method.
:::

```ts
class MyPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8 <3' })

    this.hooks = {
      'document:beforeCreate': async request => {}
    }

    this.pipes = {
      'server:afterNow': async request => request
    }
  }
}
```
