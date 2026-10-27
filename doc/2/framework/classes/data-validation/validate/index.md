---
code: true
type: page
title: validate | Framework | Core

description: DataValidation class validate() method
---

# validate

Validates the content of a request body (mutates the request).

### Arguments

```ts
validate(request: KuzzleRequest, verbose?: boolean): Promise<KuzzleRequest | { errorMessages: JSONObject, valid: boolean }>;
```

<br/>

| Arguments | Type                                                           | Description                                                                                         |
| --------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `request` | <pre>[KuzzleRequest](/core/2/framework/classes/kuzzle-request)</pre> | KuzzleRequest object with a non-empty body content                                                        |
| `verbose` | <pre>boolean</pre>                                             | Optional, default `false`. If true, returns an exhaustive validation report, instead of failing at the first encountered error |

### Return

The behavior depends on the `verbose` parameter:

- `false` (default): if the validation succeeds, the promise resolves to the request itself, with the default values of the specifications applied to its body. Otherwise, the promise is rejected with the first encountered error.
- `true`: the promise is resolved even if the validation fails, and the request is left unchanged. The promise resolves to a validation report, containing the following properties:
  - `valid`: {boolean} validation state
  - `errorMessages`: {object} the exhaustive list of encountered errors
