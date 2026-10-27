---
code: true
type: page
title: Constructor | Framework | Core

description: PartialError class constructor
---

# PartialError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object is used when an action only partially succeeded.


```ts
constructor(message: string, body?: Array<KuzzleError>, id?: string, code?: number)
constructor(message: string, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `body`         | <pre>Array&lt;KuzzleError&gt;</pre> | (optional) List of errors encountered when executing the action |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |

The second call shape, without the list of errors, is the one shared by every other error class. The two are told apart by the third argument: a number with no fourth argument means that the list of errors was left out.
