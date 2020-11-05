---
code: false
type: page
title: Customize API Errors
description: Returns custom errors in API responses
order: 600
---

# Customize API Errors

It is possible to customize the errors that we want to return in case of failure of an API request.

Kuzzle offers a set of standard errors corresponding to particular situations with customizable messages (e.g. `NotFoundError`,` ForbiddenError`, etc.)

## Standard Errors

Kuzzle exposes it's **standard errors** through an Error Manager class available under the [Backend.kerror](/core/2/some-link) property.

The following constructors are available directly in the [Backend.kerror](/core/2/some-link) property:
  - [Backend.kerror.KuzzleError](/core/2/some-link#some-anchor)
  - [Backend.kerror.UnauthorizedError](/core/2/some-link#some-anchor)
  - [Backend.kerror.TooManyRequestsError](/core/2/some-link#some-anchor)
  - [Backend.kerror.SizeLimitError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ServiceUnavailableError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PreconditionError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PluginImplementationError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PartialError](/core/2/some-link#some-anchor)
  - [Backend.kerror.NotFoundError](/core/2/some-link#some-anchor)
  - [Backend.kerror.InternalError](/core/2/some-link#some-anchor)
  - [Backend.kerror.GatewayTimeoutError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ForbiddenError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ExternalServiceError](/core/2/some-link#some-anchor)
  - [Backend.kerror.BadRequestError](/core/2/some-link#some-anchor)

::: info
If a non-standard error is thrown, Kuzzle will instead return a standard `PluginImplementationError` error, embedding the thrown error.
:::

**Example:** _Throw a PreconditionError when an action parameter is missing_
```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        if (request.input.args.name === undefined) {
          throw new app.kerror.PreconditionError('Missing "name" argument.')
        }

        return `Hello, ${request.input.args.name}`
      }
    }
  }
})
```

<!-- 
## Use preconfigured errors

@todo
-->
