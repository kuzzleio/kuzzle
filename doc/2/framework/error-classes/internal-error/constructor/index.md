---
code: true
type: page
title: Constructor
description: InternalError class constructor
---

# InternalError

Inherits from [KuzzleError](/framework/abstract-classes/kuzzle-error/constructor).

This error object is used for unexpected errors, or for assertion failures.


```ts
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
