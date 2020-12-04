---
code: true
type: page
title: validate
description: DataValidation class validate() method
---

# validate

Validates the content of a request body (mutates the request).

### Arguments

```js
validate(request: Request, verbose: boolean): Promise<any>;
```

<br/>

| Arguments | Type                                                           | Description                                                                                         |
| --------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `request` | [Request](/core/2/framework/classes/request) | Request object with a non-empty body content                                                        |
| `verbose` | <pre>boolean</pre>                                             | If true, returns an exhaustive validation report, instead of failing at the first encountered error |

### Return

The `validate` function returns a promise, and if relevant, default values are applied to the provided request.

If a validation error occurs, the behavior depends on the `validation` optional parameter:

- `false` (default): the promise is rejected with the first encountered error
- `true`: the promise is resolved even if the validation fails. The promise resolves a validation status report, containing the following properties:
  - `validation`: {boolean} validation state
  - `errorMessages`: {array} the exhaustive list of encountered errors
