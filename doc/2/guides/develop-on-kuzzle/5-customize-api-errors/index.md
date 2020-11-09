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

Kuzzle exposes **standard API errors** classes.

The following constructors are available directly in the `kuzzle` package:
  - [UnauthorizedError](/core/2/some-link#some-anchor)
  - [TooManyRequestsError](/core/2/some-link#some-anchor)
  - [SizeLimitError](/core/2/some-link#some-anchor)
  - [ServiceUnavailableError](/core/2/some-link#some-anchor)
  - [PreconditionError](/core/2/some-link#some-anchor)
  - [PluginImplementationError](/core/2/some-link#some-anchor)
  - [PartialError](/core/2/some-link#some-anchor)
  - [NotFoundError](/core/2/some-link#some-anchor)
  - [InternalError](/core/2/some-link#some-anchor)
  - [GatewayTimeoutError](/core/2/some-link#some-anchor)
  - [ForbiddenError](/core/2/some-link#some-anchor)
  - [ExternalServiceError](/core/2/some-link#some-anchor)
  - [BadRequestError](/core/2/some-link#some-anchor)

::: info
If a non-standard error is thrown, Kuzzle will instead return a standard `PluginImplementationError` error, embedding the thrown error.
:::

**Example:** _Throw a PreconditionError when an action parameter is missing_
```js
import { Backend, ForbiddenError } from 'kuzzle'

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        if (request.input.args.name === undefined) {
          throw new PreconditionError('Missing "name" argument.')
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
