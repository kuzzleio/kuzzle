---
code: false
type: page
title: Properties
description: PluginContext class properties
---

# PluginContext

The `PluginContext` class is passed to the plugins as an argument of the [init](/core/2/some-link) method.  

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

<DeprecatedBadge version="change-me"/>

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

## `errorsManager`

<DeprecatedBadge version="change-me"/>

This property is an instance of the [Errors Manager](/core/2/some-link).  

::: info
The usage of this property is deprecated and the [PluginContext.kerror](/core/2/framework/classes/plugin-context#kerror) property should be used instead.
:::

::: warning
This property is not available in Typescript.
:::

## `kerror`

This property is an instance of the [ErrorsManager](/core/2/framework/classes/errors-manager).  

It allows to instantiate [Custom API Errors](/core/2/guides/some-link) complying with the [Error Payload](/core/2/api/payloads/error).

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[ErrorsManager](/core/2/framework/classes/errors-manager)</pre> | PluginContextConstructors instance |

## `log`

This property is an instance of the [InternalLogger](/core/2/framework/classes/internal-logger) and allows to log messages.

| Type                                                                 | Description            |
|----------------------------------------------------------------------|------------------------|
| <pre>[InternalLogger](/core/2/framework/classes/internal-logger)</pre> | PluginContextConstructors instance |

See also the [Internal Logger](/core/2/guides/advanced/10-internal-logger) guide.

## `secrets`

This property contains the application secrets that have been made available with the [Secrets Vault](/core/2/guides/advanced/1-secrets-vault).

| Type                  | Description            |
|-----------------------|------------------------|
| <pre>JSONObject</pre> | Decrypted application secrets |
