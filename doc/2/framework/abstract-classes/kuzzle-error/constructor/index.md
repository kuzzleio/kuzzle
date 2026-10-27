---
code: true
type: page
title: Constructor | Framework | Core

description: KuzzleError abstract class constructor
---

# KuzzleError

Inherits from the standard Javascript `Error` object: abstract class inherited by all Kuzzle error objects.

This class can be used to create new standardized Kuzzle error objects for API responses.

---

```ts
constructor(message: string | Error, status: number, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string \| Error</pre> | Error message. If an `Error` is passed, its message and stack trace are kept |
| `status`       | <pre>number</pre> | Error status code (Kuzzle's API errors follow the HTTP standard) |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
