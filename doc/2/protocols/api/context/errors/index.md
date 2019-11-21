---
code: true
type: page
title: errors
---

# errors

The `context.errors` object regroups all error objects, used in request responses, or to be used by the protocol if needs be.

---

## KuzzleError



Inherits from the standard Javascript `Error` object: abstract class inherited by all Kuzzle error objects.

This class should only be used to create new Kuzzle error objects.

### Properties

| Properties | Type                | Description                                                                                                           |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `message`  | <pre>string</pre>   | Error message                                                                                                         |
| `stack`    | <pre>string[]</pre> | Error stack trace (not available in production mode)                                                                  |
| `status`   | <pre>integer</pre>  | Error status code, following the standard [HTTP status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) |

---

## BadRequestError



Invalid request syntax.

### Status code

`400`

### Example

```js
const err = new context.errors.BadRequestError('error message');
```

---

## ExternalServiceError



External service failure.

### Status Code

`500`

### Example

```js
const err = new context.errors.ExternalServiceError('error message');
```

---

## ForbiddenError



Unauthorized access to a resource.

### Status Code

`403`

### Example

```js
const err = new context.errors.ForbiddenError('error message');
```

---

## GatewayTimeoutError



Timeout error.

### Status code

`504`

### Example

```js
const err = new context.errors.GatewayTimeoutError('error message');
```

---

## InternalError



Unexpected error. Should be reserved for Kuzzle's use only.

### Status Code

`500`

### Example

```js
const err = new context.errors.InternalError('error message');
```

---

## NotFoundError



Resource not found.

### Status Code

`404`

### Example

```js
const err = new context.errors.NotFoundError('error message');
```

---

## ParseError

 / <DeprecatedBadge version="1.4.1" />

Parse error. Use [BadRequestError](/core/2/protocols/api/context/errors#badrequesterror) instead.

### Status Code

`400`

### Example

```js
const err = new context.errors.ParseError('error message');
```

---

## PartialError



Partial request success.

### Constructor

```js
new context.error.PartialError(message, errors);
```

<br/>

| Arguments  | Type                                                                                       | Description                |
| ---------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `message`  | <pre>string</pre>                                                                          | Error message              |
| `failures` | `KuzzleError[]` | List of encountered errors |

### Status Code

`206`

### Example

```js
const err = new context.errors.PartialError('error message', [
  new context.errors.BadRequestError('[request part] invalid format'),
  new context.errors.ForbiddenError('[other request part] forbidden')
]);
```

---

## PluginImplementationError



Unexpected plugin failure.

### Status Code

`500`

### Example

```js
const err = new context.errors.PluginImplementationError('error message');
```

---

## PreconditionError



Unmet request prerequisites.

### Status Code

`412`

### Example

```js
const err = new context.errors.PreconditionError('error message');
```

---

## ServiceUnavailableError



Temporarily unable to respond.

### Status Code

`503`

### Example

```js
const err = new context.errors.ServiceUnavailableError('error message');
```

---

## SizeLimitError



Request exceeds the maximum limits.

### Status Code

`413`

### Example

```js
const err = new context.errors.SizeLimitError('error message');
```

---

## UnauthorizedError



Authentication failed.

### Status Code

`401`

### Example

```js
const err = new context.errors.UnauthorizedError('error message');
```
