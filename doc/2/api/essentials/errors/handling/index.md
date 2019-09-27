---
code: false
type: page
title: Handling Errors
description: Understanding the Kuzzle error handling mechanisms
order: 0
---

# Error Handling

All errors received by Kuzzle clients are `KuzzleError` error objects.

A `KuzzleError` object has the following properties:

| Property     | Type               | Description                                            |
| ------------ | ------------------ | ------------------------------------------------------ |
| `status`     | <pre>number</pre>            | HTTP status code                                       |
| `message`    | <pre>string</pre>               | Short description of the error                         |
| `stack`      | <pre>string</pre>               | (Available in development mode only) Error stack trace |
| `id`  | <pre>string</pre>  | Error unique identifier |
| `code`       | <pre>number</pre> | Error unique code |

Clients can detect the error type based on the `status` and process the error accordingly.


### id

The `id` property is a concatenation of 3 levels of precisions, telling what kind of error it is.

For instance, the error `api.assert.missing_argument` is triggered because an API assertion, indicating that a received request is malformed.

You can see the full definition about Kuzzle errors [here](/core/2/api/essentials/errors/codes/)

---

### code

The `code` property is a concatenation of 3 codes:
- The domain code (eg. `02` for `api`).
- The subdomain code (eg. `04` for `auth`).
- The proper error code (eg. `0001` for `database_not_found`).

So a `code` `0x02040001` has `02` as domain code on 1 byte, `04` as subdomain code on 1 byte and `0001` as error code on 2 bytes.

The full list of Kuzzle API errors is available [here](/core/2/api/essentials/errors/codes).


## Common errors

All Kuzzle requests can return one of the following errors:

### BadRequestError


**status**: 400

A `BadRequestError` error is thrown if Kuzzle was unable to process the action due to a malformed request, or if required parameters are missing.

---

### ExternalServiceError



**status**: 500

An `ExternalServiceError` error is thrown if Kuzzle was unable to process the action due to an external service failure (e.g. database down).

---

### ForbiddenError



**status**: 403

A `ForbiddenError` error is thrown if the current authenticated user is not authorized to perform the requested action.

---

### GatewayTimeoutError



**status**: 504

A `GatewayTimeoutError` error is thrown if Kuzzle, or a plugin, takes too long to respond.

Receiving this error does not guarantee the original request was not processed, just that it was not processed _in time_.

The Client Application will have to determine if the process was completed.

---

### InternalError



**status**: 500

An `InternalError` error is thrown if Kuzzle encountered an unexpected error.

---

### PluginImplementationError



**status**: 500

A `PluginImplementationError` error is a generic error thrown by Kuzzle on a [plugin](/core/2/plugins) failure.

---

### ServiceUnavailableError



**status**: 503

A `ServiceUnavailableError` error can be sent by Kuzzle if it overloaded and cannot temporarily accept new requests, or if the requested Kuzzle instance is shutting down.

---

## Specific errors

These errors are specific to controller actions.
Check controllers documentation.

### NotFoundError



**status**: 404

A `NotFoundError` error is thrown if the requested resource could not be found (e.g. a document is requested with a non-existing id).

---

### PartialError



**status**: 206

A `PartialError` error is thrown if Kuzzle was unable to process a subset of a multi-action request.

A `PartialError` can be triggered, for instance, if one or several queries inside a `document:mCreate` request failed.

The detail of each failure can be retrieved in the `errors` property of the error object.

### Additional Properties

| property | type             | description                    |
| -------- | ---------------- | ------------------------------ |
| `count`  | integer          | Number of failures encountered |
| `errors` | array of objects | Failed actions                 |

---

### PreconditionError



**status**: 412

A `PreconditionError` error is thrown if Kuzzle was not able to process the request due to an invalid state.

For instance, this error can be generated when trying to create a document on a non-existing index.

---

### SizeLimitError



**status**: 413

A `SizeLimitError` error is thrown by Kuzzle if the request size exceeds the limits defined in the [configuration](/core/2/guides/essentials/configuration).

---

### UnauthorizedError



**status**: 401

An `UnauthorizedError` error is thrown by Kuzzle when an authentication attempt failed, or if a requested resource needs an authentication to be accessed.
