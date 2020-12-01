---
code: false
type: page
title: Properties
description: Plugin abstract class properties
---

# Plugin

Base class for [External Plugins](/core/2/guides/write-plugins).  

Plugins registered with the [BackendPlugin.use](/core/2/framework/classes/backend-plugin/use) method must extends this abstract class.

Some properties of the `Plugin` class allows to define a set of features that will be integrated to the plugin. 

## `api`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>PluginApiDefinition</pre> | Define new API controllers PluginApiDefinition |


The `PluginApiDefinition` type is an object with each key as a controller name and the value is a valid [ControllerDefinition](/core/2/framework/types/controller-definition).

```js
type PluginApiDefinition = {
  /**
   * Name of the API controller.
   */
  [controller: string]: ControllerDefinition
}
```

## `config`

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>JSONObject</pre> | Plugin configuration |

## `context`

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[PluginContext](/core/2/framework/classes/plugin-context)</pre> | [PluginContext](/core/2/framework/classes/plugin-context) instance |

## `hooks`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>`PluginHookDefinition`</pre> | Allows to define hooks on events |

The `PluginHookDefinition` type is an object with each key as an event name and the value is a valid [EventHandler](/core/2/framework/types/event-handler).

```js
export type PluginHookDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: EventHandler | EventHandler[]
}
```

## `pipes`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>`PluginPipeDefinition`</pre> | Allows to define pipess on events |

The `PluginPipeDefinition` type is an object with each key as an event name and the value is a valid [EventHandler](/core/2/framework/types/event-handler).

```js
export type PluginPipeDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: EventHandler | EventHandler[]
}
```

## `strategies`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[StrategyDefinition](/core/2/framework/types/strategy-definition)</pre> | A valid [StrategyDefinition](/core/2/framework/types/strategy-definition) object. |

## `controllers`

<DeprecatedBadge version="change-me"/>

::: info
Controllers should be defined in the [api](#api) property.

This property is not available in Typescript.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>object</pre> | Controllers definition object |


**Example:**

```js
class MyPlugin {
  init (config, context) {
    this.controllers = {
      greeting: {
        sayHello: request => `Hello, ${request.input.args.name}`,
        sayGoodbye: 'greetingSayGoodbye'
      }
    };
  }

  async greetingSayGoodbye (request) {
    return `Goodbye, ${request.input.args.name}`
  }
}
```

## `routes`

<DeprecatedBadge version="change-me"/>

::: info
Routes should be defined in the [api](#api) property.

This property is not available in Typescript.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>object</pre> | Routes definition object |

**Example:**
```js
class MyPlugin {
  init (config, context) {
    this.controllers = {
      greeting: {
        sayHello: request => `Hello, ${request.input.args.name}`
      }
    };

    this.routes = [
      { verb: 'get', path: '/greeting/:name', controller: 'greeting', action: 'sayHello' }
    ];
  }
}
```
