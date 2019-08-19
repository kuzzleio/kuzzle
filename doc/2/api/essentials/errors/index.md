---
code: false
type: page
title: Error Handling
description: Understanding the Kuzzle error handling mechanisms
order: 500
---

# Error Handling

All errors received by Kuzzle clients are `KuzzleError` error objects.

A `KuzzleError` object has the following properties:

| property  | type    | description                                            |
| --------- | ------- | ------------------------------------------------------ |
| `status`  | integer | HTTP status code                                       |
| `message` | text    | Short description of the error                         |
| `stack`   | text    | (Available in development mode only) Error stack trace |

Clients can detect the error type based on the `status` and process the error accordingly.

---

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


## Errors Manager  



Kuzzle provide a way to customize errors codes by dividing them in 3 distinct properties :

  

- The `domain` of the error

- The `subdomain`, which brings more precision about the context

- and the proper `error`

  

Each `domain` is defined in a json file loaded by Kuzzle at start.

In it are defined their `subdomains` and `errors` with their message to send and the proper [KuzzleError](https://docs.kuzzle.io/core/1/plugins/plugin-context/errors/kuzzleerror/).

  

Here is the actual domains list:

  

-  `internal`

-  `external`

-  `api`

-  `plugins`

-  `network`

  

You can find them [here](https://github.com/kuzzleio/kuzzle/tree/master/lib/config/error-codes) and see their full definitions.
Each domain, subdomain and errors has an unique code, Kuzzle prevents duplicates for each level.

Let's have an example.

Every errors concerning the api are defined in a `api.json`. Here how it goes :

```
{
  "code": 2,
  "subdomains": {
    "base": {
      "code": 1,
      "errors": {
        "invalid_value_type": {
          "code": 1,
          "message": "Invalid '%s' value (%s).",
          "class": "BadRequestError"
        }
      }
    },
    "server": {
      "code": 2,
      "errors": {
        "elasticsearch_down": {
          "code": 1,
          "message": "ElasticSearch is down: %s.",
          "class": "ExternalServiceError"
        },
        "service_unavailable": {
          "code": 2,
          "message": "Error : %s.",
          "class": "ServiceUnavailableError"
        }
      }
    },
    "document": {
      "code": 3,
      "errors": {
        "not_found": {
          "code": 1,
          "message": "The document does not exist: %s.",
          "class": "NotFoundError"
        },
        "search_on_multiple_indexes": {
          "code": 2,
          "message": "Search on multiple indexes is not available.",
          "class": "BadRequestError"
        },
        "search_on_multiple_collections": {
          "code": 3,
          "message": "Search on multiple collections is not available.",
          "class": "BadRequestError"
        },
        "missing_scroll_id": {
          "code": 4,
          "message": "Missing 'scrollId' argument.",
          "class": "BadRequestError"
        },
        "get_limit_reached": {
          "code": 5,
          "message": "Number of gets to perform exceeds the server configured value ( %s ).",
          "class": "SizeLimitError"
        },
        "creation_failed": {
          "code": 6,
          "message": "Some document creations failed : %s.",
          "class": "PartialError"
        },
        "deletion_failed": {
          "code": 7,
          "message": "Some document deletions failed : %s.",
          "class": "PartialError"
        }
      }
    },
    "admin": {
      "code": 4,
      "errors": {
        "database_not_found": {
          "code": 1,
          "message": "Database %s not found.",
          "class": "NotFoundError"
        },
        "action_locked": {
          "code": 2,
          "message": "Lock action error: %s.",
          "class": "PreconditionError"
        }
      }
    },
```
  

Let's say you want to throw an error which has `api` as domain, `admin` as subdomain and an error called `database_not_found`.

If you use the `errorsManager` to throw this error, you could write: `errorsManager.throw('api', 'admin', 'database_not_found', 'foobar')`.

Doing that, you will throw a KuzzleError of type PreconditionError with the message `"Database foobar not found."`, and object's properties `domain`  `subdomain` and `error` settled.

  

## Errors Manager inside Plugins

When creating your own Kuzzle plugin, you can use the errors manager.
In order to define your customs errors, you have to write it inside the [manifest.json](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/prerequisites/#manifest-json) in a `errors` field.
Your manifest will be something like :
```
{
    "name": "kuzzle-plugin-xxx",
    "kuzzleVersion": ">=1.0.0 <2.0.0",
    "privileged": false,
    "errors": {
        "some_error": {
            "code": 1,
            "message": "Some error occurred %s",
            "class": "BadRequestError"
	},
        "some_other_error": {
            "code": 2,
            "message": "Some other error occurred %s",
            "class": "ForbiddenError"
	}
    }
}
```
Here, Kuzzle will automatically assign the domain and subdomain.
They will be respectively `plugins` and the name of the plugin `kuzzle-plugin-xxx`.


 You can access the errorsManager when creating your own plugins Kuzzle.
 Functions you need are exposed in the [PluginContext](https://docs.kuzzle.io/core/1/plugins/plugin-context/accessors/intro/).
 If you want to throw your customs errors, you could write `context.errorsManager.throw(errorName, placeholders);`.
 The function that build the error class without throwing is accessible by doing `context.errorsManager.getError(errorName, placeholders);`