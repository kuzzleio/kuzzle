---
code: true
type: page
title: Constructor | Framework | Core

description: BadRequestError class constructor
---

# BadRequestError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object is used for invalid API requests.


```ts
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
