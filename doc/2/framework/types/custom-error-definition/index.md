---
code: false
type: page
title: CustomErrorDefinition | Framework | Core

description: CustomErrorDefinition type definition
---

# CustomErrorDefinition

The `CustomErrorDefinition` type describes a custom error, registered with [BackendErrors.register](/core/2/framework/classes/backend-errors/register).

| Property      | Type              | Description                                                                                                                                        |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | <pre>string</pre> | Name of the [error class](/core/2/framework/error-classes) of the error: `BadRequestError`, `NotFoundError`, `TooManyRequestsError`, `KuzzleError`... |
| `description` | <pre>string</pre> | Error description, for documentation purposes                                                                                                      |
| `message`     | <pre>string</pre> | Error message. `%s` placeholders are replaced by the placeholders given to [BackendErrors.get](/core/2/framework/classes/backend-errors/get)          |
| `status`      | <pre>number</pre> | (optional) HTTP status of the error. Only used when `class` is `KuzzleError` (default: `500`): the other classes have their own status             |

The error code is computed by Kuzzle from the domain, subdomain and position of the error.

**Example:**

```ts
import { CustomErrorDefinition } from 'kuzzle';

const definition: CustomErrorDefinition = {
  class: 'BadRequestError',
  description: 'The given name is not a valid city name',
  message: 'Invalid city name: %s',
};

app.errors.register('app', 'api', 'invalid_city', definition);
```
