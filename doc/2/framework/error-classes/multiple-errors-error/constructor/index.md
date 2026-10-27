---
code: true
type: page
title: Constructor | Framework | Core

description: MultipleErrorsError class constructor
---

# MultipleErrorsError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object gathers several errors into one, for instance when several checks of a request failed.

Unlike [PartialError](/core/2/framework/error-classes/partial-error), it means that the action failed as a whole.


```ts
constructor(message: string, errors?: Array<KuzzleError>, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `errors`       | <pre>Array&lt;KuzzleError&gt;</pre> | (optional) List of errors (default: `[]`) |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |

## Usage

```ts
import { BadRequestError, MultipleErrorsError } from 'kuzzle';

throw new MultipleErrorsError('Invalid order', [
  new BadRequestError('Missing "customerId"'),
  new BadRequestError('Field "quantity" must be a positive number'),
]);
```
