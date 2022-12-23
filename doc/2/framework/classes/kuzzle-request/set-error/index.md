---
code: true
type: page
title: setError | Framework | Core

description: KuzzleRequest class setError() method
---

# setError

Adds an error to the request, and sets the request's status to the error one.

### Arguments

```ts
setError(error: Error): void;
```

</br>


| Name | Type | Description                      |
|------|------|----------------------------------|
| `error` | <pre>Error</pre> | Error object to set |

If a `KuzzleError` is provided, the request's status attribute is set to the error one.

Otherwise, the provided error is encapsulated into an `InternalError` object, and the request's status is set to 500.
