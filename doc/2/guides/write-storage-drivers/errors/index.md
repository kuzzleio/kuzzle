---
code: false
type: page
order: 300
title: Errors | Write storage drivers | Guide
meta:
  - name: description
    content: The errors a Kuzzle storage driver throws
  - name: keywords
    content: Kuzzle, Documentation, storage driver, errors, storageError
---

# Errors

<SinceBadge version="2.61.0" />

A driver throws **Kuzzle's storage errors**, so that a client gets the same error whatever the engine. `kuzzle`
exports them as `storageError`, which builds the `services.storage.*` errors listed in the
[error codes](/core/2/api/errors/error-codes/services) page:

```ts
import { storageError } from "kuzzle";

// services.storage.not_found: Document "<id>" not found in "<index>":"<collection>".
throw storageError.get("not_found", id, index, collection);
```

`storageError.get(id, ...placeholders)` fills the error's message with the placeholders, in the order its code
states; `storageError.reject(...)` returns the same error as a rejected promise.

Translate the engine's own errors into the closest storage error:

| Engine situation | Error |
| --- | --- |
| Document not found | `not_found` |
| Document already exists | `document_already_exists` |
| Index or collection not found | `unknown_index`, `unknown_collection` |
| Version conflict | `too_many_changes` |
| Engine unreachable | `not_connected` |
| Unsupported engine version | `version_mismatch` |
| Anything else | `unexpected_error`, with the engine's message |

The other error classes (`BadRequestError`, `NotFoundError`, `KuzzleError`...) are exported by `kuzzle` too. Import
them from the `kuzzle` peer dependency, never from a copy of Kuzzle of your own: Kuzzle recognizes its errors by
class, and an error from another copy reaches clients as an internal error.

::: info
A request needing a capability your driver does not declare never reaches it: Kuzzle rejects it first, with
`services.storage_driver.unsupported_capability`.
:::
