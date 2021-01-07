---
code: true
type: page
title: Constructor
description: PartialError class constructor
---

# PartialError

Inherits from [KuzzleError](/core/2/framework/abstract-classes/kuzzle-error/constructor).

This error object is used when an action only partially succeeded.


```ts
constructor(message: string, failures: Array<KuzzleError>, id?: string, code?: number)
```

<br/>

| Argument       | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `message`      | <pre>string</pre> | Error message  |
| `failures`     | <pre>Array&lt;KuzzleError&gt;</pre> | List of errors encountered when executing the action |
| `id`           | <pre>string</pre> | (optional) Error unique name |
| `code`         | <pre>number</pre> | (optional) Error unique code |
