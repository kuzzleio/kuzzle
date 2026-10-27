---
code: true
type: page
title: Constructor | Framework | Core

description: TooManyRequestsError class constructor
---

# TooManyRequestsError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object is used when a request is refused because too many requests, or a concurrent task, are already being processed.


```ts
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |

## Usage

```ts
import { TooManyRequestsError } from 'kuzzle';

throw new TooManyRequestsError('That task is already ongoing');
```
