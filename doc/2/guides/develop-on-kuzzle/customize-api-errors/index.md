---
code: false
type: page
title: Customize API Errors
description: Returns custom errors in API responses
order: 600
---

# Customize API Errors

It is possible to customize the errors that we want to return in case of failure of an API request.

Kuzzle offers a set of standard errors corresponding to specific situations with customizable messages (e.g. `NotFoundError`,` ForbiddenError`, etc.)

## Standard Errors

Kuzzle exposes **standard API errors** classes.

The following constructors are available directly in the `kuzzle` package:
  - [UnauthorizedError](/core/2/api/errors/types)
  - [TooManyRequestsError](/core/2/api/errors/types)
  - [SizeLimitError](/core/2/api/errors/types)
  - [ServiceUnavailableError](/core/2/api/errors/types)
  - [PreconditionError](/core/2/api/errors/types)
  - [PluginImplementationError](/core/2/api/errors/types)
  - [PartialError](/core/2/api/errors/types)
  - [NotFoundError](/core/2/api/errors/types)
  - [InternalError](/core/2/api/errors/types)
  - [GatewayTimeoutError](/core/2/api/errors/types)
  - [ForbiddenError](/core/2/api/errors/types)
  - [ExternalServiceError](/core/2/api/errors/types)
  - [BadRequestError](/core/2/api/errors/types)

::: info
If a non-standard error is thrown, Kuzzle will instead return a standard `PluginImplementationError` error, embedding the thrown error.
:::

**Example:** _Throw a PreconditionError when an action parameter is missing_
```js
import { Backend, PreconditionError } from 'kuzzle';

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        if (request.input.args.name === undefined) {
          throw new PreconditionError('Missing "name" argument.');
        }

        return `Hello, ${request.input.args.name}`;
      }
    }
  }
});
```

<!-- 
## Use preconfigured errors

@todo
-->
