---
code: true
type: page
title: getArrayFromBodyOrArgs | Framework | Core

description: KuzzleRequest class getArrayFromBodyOrArgs() method
---

# getArrayFromBodyOrArgs

<SinceBadge version="2.20.1" />

Gets an array parameter, from the request body or from the request arguments depending on how the request was sent:

- with the HTTP protocol and the `GET` verb, there is no body: the parameter is read from the request arguments (the query string) as a JSON string, and parsed;
- otherwise, the parameter is read from the request body, as with [getBodyArray](/core/2/framework/classes/kuzzle-request/get-body-array).

Throws an `api.assert.missing_argument` error if the parameter is not set and no default value is provided, and an `api.assert.invalid_type` error if it is not an array or not a valid JSON string.

### Arguments

```ts
getArrayFromBodyOrArgs (name: string, def?: any): JSONObject
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>array</pre> | Default value to return if the parameter is not set |

::: info
The return type is declared `JSONObject` for backward compatibility, but the value is an array.
:::

### Example

```ts
// GET /_/my-controller/sort?sort=["name","age"]
// or POST /_/my-controller/sort with the body { "sort": ["name", "age"] }
const sort = request.getArrayFromBodyOrArgs('sort', []);
```
