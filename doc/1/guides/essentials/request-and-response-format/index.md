---
code: false
type: page
title: Request and Response Format
order: 800
---

# Request and Response Format

Any access to a Kuzzle resource must be made through a [request](https://github.com/kuzzleio/kuzzle-common-objects#request). The `Request` object is [sealed](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/seal), which means you cannot add or delete fields once the object is initialized. The `Request` state evolves along with the [lifecycle of the transaction](/core/1/guides/essentials/request-and-response-format/#request-life-cycle).

Let's take a look at the structure of the `Request` object.

```js
Request {
    // members
    status,     // {integer}        The status of the transaction (matches HTTP codes)
    timestamp,  // {integer}
    id,         // {string}
    context,    // {RequestContext} Contains information about the connection and the current token & user
    input,      // {RequestInput}   The request input params sent by the client
    result,     // {Object}         The raw result sent by the controller (defaults to null)
    error,      // {KuzzleError}    Defaults to null
    response,   // {property}       The final response sent out of Kuzzle (enumerable, get-only property)

    // methods
    setError (error),               // Sets the status to the error.code and fills the error member.
    setResult (obj, [status=200])   // Sets the result and the status code.
}
```

Let's take a look at the attributes of this object.

- The `id` attribute bears a unique, auto-generated value that identifies the transaction.
- The `timestamp` attribute stores the creation date (in seconds after the Epoch time).

---

## Input

The `input` field contains all the parameters that express the request from the client. It has the following structure:

```js
RequestInput {
    // members
    args,           // {Object}     Parametric arguments (e.g. for REST, taken from the query string)
    volatile,       // {Object}
    body,           // {Object}     Content of the resource for REST like routes, main parameters for others
    controller,     // {string}
    action,         // {string}
    resource {
        index,
        collection,
        _id
    }

    // methods
    constructor (data) // data is a JS Object that has the same structure as the Websocket message
}
```

---

## Context

The `context` attribute contains information about the state of the connection at the moment the request is sent. It has the following structure:

```js
RequestContext {
    connection {    // Network connection information
      id,           // {scalar}     Unique identifier of the user connection
      protocol,     // {string}     Network protocol name
      ips,          // {Array}      Chain of IP addresses, starting from the client
      misc          // {Object}     Contains protocol specific information (e.g. HTTP queries URL or headers)
    },
    token,          // {Token}      Auth token
    user            // {User}       Represents the current User associated to the transaction
}
```

---

## Status Codes

The `status` attribute is a numeric code similar to a [HTTP status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes).
It is used to inform the client about the resulting status of the request (i.e. if an error occurred or not).

### List of Status Codes Supported by Kuzzle

#### 1xx Processing

- `102`: Standard status for an unhandled request.

#### 2xx Success

- `200`: Standard status for a successful request.
- `206`: The request (typically a bulk import) is partially successful: some actions encountered an error.
  (in this case, error details are returned within _error.errors_)

#### 4xx Client Error

- `400`: The request is malformed (usually: an argument is missing).
- `401`: A login attempt failed.
- `403`: The client is not allowed to perform the requested action.
- `404`: The requested resource cannot be found.
- `412`: A pre-requisite is not satisfied (for instance, adding a non-existing Profile to a User)
- `413`: A query input or response exceeds a configured Kuzzle limit.

#### 5xx Server Error

- `500`: Kuzzle encountered an unexpected error.
- `503`: Kuzzle is temporarily unavailable.
- `504`: An external resource takes too long to respond.

---

## Error Object Format

When an error occurs, the `error` attribute contains the [KuzzleError](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#errorskuzzleerror) object, which inherits from the primitive Javascript `Error` type.

---

## Request Life-Cycle

Here is how the request life-cycle works:

- The client initializes the object with the arguments passed to the [constructor](https://github.com/kuzzleio/kuzzle-common-objects#new-requestdata-options).
  - The `status` field is always initialized to 102 ("processing").
  - The `context` field is initialized with the connection status and ID.
  - The `input` field is initialized with the request parameters specified in the options.
  - The fields `error`, `result` and `response` contain `null`.
- Kuzzle receives the response. The corresponding controller handles it according to the `input` field.
  - The raw response of the controller is set to the `result` field.
  - If an error occurs, Kuzzle updates the `error` field via the `setError` method.
  - The `status` field is then set with an HTTP-compliant numeric code.
  - Kuzzle sets the `response` as per the [Kuzzle Response API Standard](/core/1/api/essentials/kuzzle-response)
- Kuzzle sends the response back to the client.
