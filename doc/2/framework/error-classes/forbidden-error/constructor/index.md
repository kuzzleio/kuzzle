---
code: true
type: page
title: Constructor | Framework | Core

description: ForbiddenError class constructor
---

# ForbiddenError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object is used on an unauthorized attempt to access a resource.


```ts
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
