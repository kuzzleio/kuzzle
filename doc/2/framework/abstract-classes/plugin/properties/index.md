---
code: false
type: page
title: Properties | Framework | Core

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

## `authenticators`

::: info
This property allows to define plugin features.
:::

| Type                   | Description |
|------------------------|-------------|
| <pre>JSONObject</pre> | Authenticator classes, by name |

Each key is an authenticator name, and each value is a class (a constructor) implementing a [Passport](http://www.passportjs.org/) strategy. The [strategies](#strategies) of the plugin refer to them by name, in their `config.authenticator` property.

Kuzzle throws a `plugin.authenticators.not_an_object` error if the property is not an object, and a `plugin.authenticators.invalid_authenticator` error if one of its values is not a constructor.

See also the [Integrate an Authentication Strategy](/core/2/guides/write-plugins/integrate-authentication-strategy#exposing-authenticators) guide.

```js
const LocalStrategy = require('passport-local').Strategy;

class MyPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8.0 <3' });

    this.authenticators = { Local: LocalStrategy };
  }
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

The `PluginHookDefinition` type is an object with each key as an event name and the value is a valid [HookEventHandler](/core/2/framework/types/event-handler).

```js
export type PluginHookDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: HookEventHandler | HookEventHandler[]
}
```

::: warning
<DeprecatedBadge version="2.8.0"/>

A hook handler can also be given as the **name** of one of the plugin's methods (a string). This form is deprecated, and Kuzzle prints a deprecation warning when it registers the handler: pass the function instead.
:::

## `imports`

<SinceBadge version="2.20.2"/>

::: info
This property allows to define plugin features.
:::

| Type                   | Description |
|------------------------|-------------|
| <pre>[ImportConfig](/core/2/framework/types/import-config)</pre> | Mappings, roles, profiles and users to import when Kuzzle starts |

Kuzzle merges the `imports` of every plugin, then merges the application imports (set with [BackendImport](/core/2/framework/classes/backend-import)) over them, and imports the result at startup.

```js
class MyPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8.0 <3' });

    this.imports = {
      roles: {
        mailer: {
          controllers: { 'my-plugin/mail': { actions: { send: true } } },
        },
      },
    };
  }
}
```

## `pipes`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>`PluginPipeDefinition`</pre> | Allows to define pipes on events |

The `PluginPipeDefinition` type is an object with each key as an event name and the value is a valid [PipeEventHandler](/core/2/framework/types/event-handler).

```js
export type PluginPipeDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: PipeEventHandler | PipeEventHandler[]
}
```

::: warning
<DeprecatedBadge version="2.8.0"/>

A pipe handler can also be given as the **name** of one of the plugin's methods (a string). This form is deprecated, and Kuzzle prints a deprecation warning when it registers the handler: pass the function instead.
:::

## `strategies`

::: info
This property allows to define plugin features.
:::

| Type                                                                   | Description             |
|------------------------------------------------------------------------|-------------------------|
| <pre>[StrategyDefinition](/core/2/framework/types/strategy-definition)</pre> | A valid [StrategyDefinition](/core/2/framework/types/strategy-definition) object. |

## `controllers`

<DeprecatedBadge version="2.8.0"/>

<CustomBadge type="warning" text="Not available in Typescript"/>

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

<DeprecatedBadge version="2.8.0"/>

<CustomBadge type="warning" text="Not available in Typescript"/>

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
