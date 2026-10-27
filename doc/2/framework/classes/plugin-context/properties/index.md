---
code: false
type: page
title: Properties | Framework | Core

description: PluginContext class properties
---

# PluginContext

The `PluginContext` class is passed to the plugins as an argument of the [init](/core/2/framework/abstract-classes/plugin/init) method.  

It contains various accessors, constructors and helpers that allow to interact with Kuzzle.

## `accessors`

This property is an instance of the [PluginContextAccessors](/core/2/framework/classes/plugin-context-accessors) and contains various methods to interact with Kuzzle.  

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[PluginContextAccessors](/core/2/framework/classes/plugin-context-accessors)</pre> | PluginContextAccessors instance |

## `constructors`

This property is an instance of the [PluginContextConstructors](/core/2/framework/classes/plugin-context-constructors) and contains various constructors to interact with Kuzzle.  

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[PluginContextConstructors](/core/2/framework/classes/plugin-context-constructors)</pre> | PluginContextConstructors instance |

## `errors`

<DeprecatedBadge version="2.8.0"/>

This property contains constructors that represent [Kuzzle Errors Types](/core/2/api/errors/types).  

::: info
The usage of this property is deprecated and Kuzzle Errors should be required from the `kuzzle` package instead.
:::

::: warning
This property is not available in Typescript.
:::

**Available errors:**

```
BadRequestError
ExternalServiceError
ForbiddenError
GatewayTimeoutError
InternalError
KuzzleError
NotFoundError
PartialError
PluginImplementationError
PreconditionError
ServiceUnavailableError
SizeLimitError
TooManyRequestsError
UnauthorizedError
```

## `config`

A frozen copy of the whole Kuzzle configuration.

| Type                  | Description                    |
|-----------------------|--------------------------------|
| <pre>JSONObject</pre> | Kuzzle configuration (read-only) |

## `errorsManager`

<DeprecatedBadge version="2.8.0"/>

Alias of [kerror](#kerror). Use `kerror` instead.

## `kerror`

Errors manager bound to the `plugin` domain and to a subdomain named after the plugin. It creates the errors declared in the `errors` section of the plugin's `manifest.json`.

| Type           | Description    |
|----------------|----------------|
| <pre>any</pre> | Errors manager |

It exposes the following methods:

| Method | Description |
|--------|-------------|
| `get(name: string, ...placeholders): KuzzleError` | Returns the error defined under `name` |
| `getFrom(source: Error, name: string, ...placeholders): KuzzleError` | Same as `get`, keeping the stack trace of `source` |
| `reject(name: string, ...placeholders): Promise<never>` | Returns a promise rejected with the error |

### Usage

```js
throw context.kerror.get('some_error', 'placeholder value');
```

## `log`

<DeprecatedBadge version="2.48.0"/>

Kept for backward compatibility only: use [logger](#logger) instead.

A plain object with the `debug`, `error`, `info`, `silly`, `verbose` and `warn` methods. Each one takes a single `message` and forwards it to [logger](#logger), prefixed with `[<plugin name>]`. `silly` and `verbose` log with the `trace` level.

| Type                  | Description                         |
|-----------------------|-------------------------------------|
| <pre>JSONObject</pre> | Backward-compatible logging methods |

## `logger`

<SinceBadge version="2.48.0"/>

A child of the Kuzzle logger, with the plugin name as namespace.

It has the [trace](/core/2/framework/classes/logger/trace), [debug](/core/2/framework/classes/logger/debug), [info](/core/2/framework/classes/logger/info), [warn](/core/2/framework/classes/logger/warn), [error](/core/2/framework/classes/logger/error), [fatal](/core/2/framework/classes/logger/fatal), [flush](/core/2/framework/classes/logger/flush) and [child](/core/2/framework/classes/logger/child) methods, and the [level](/core/2/framework/classes/logger/properties#level) property, of the [Logger](/core/2/framework/classes/logger) class. It does not have `getLevel`, `setLevel`, `silly` or `verbose`.

| Type                    | Description                                  |
|-------------------------|----------------------------------------------|
| <pre>KuzzleLogger</pre> | Plugin logger (`KuzzleLogger` from the `kuzzle-logger` package) |

### Usage

```js
context.logger.info('Plugin initialized');
```

## `secrets`

This property contains the application secrets that have been made available with the [Secrets Vault](/core/2/guides/advanced/secrets-vault).

| Type                  | Description            |
|-----------------------|------------------------|
| <pre>JSONObject</pre> | Decrypted application secrets |
