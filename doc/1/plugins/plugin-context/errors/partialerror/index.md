---
code: true
type: page
title: PartialError
---

# PartialError



Partial request success.

## Constructor

```js
new context.error.PartialError(message, failures);
```

<br/>

| Arguments  | Type                                                               | Description                |
| ---------- | ------------------------------------------------------------------ | -------------------------- |
| `message`  | <pre>string</pre>                                                  | Error message              |
| `failures` | [`KuzzleError[]`](/core/1/plugins/errors/kuzzleerror) | List of encountered errors |

## Status Code

`206`

## Example

```js
const err = new context.errors.PartialError('error message', [
  new context.errors.BadRequestError('[request part] invalid format'),
  new context.errors.ForbiddenError('[other request part] forbidden')
]);
```
