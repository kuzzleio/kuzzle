---
code: true
type: page
title: Constructor
description: ExternalServiceError class constructor
---

# ExternalServiceError

Inherits from [KuzzleError](/framework/abstract-classes/kuzzle-error/constructor).

This error object is used on an external service failure.


```ts
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
