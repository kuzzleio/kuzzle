---
code: true
type: page
title: getObjectFromBodyOrArgs | Framework | Core

description: KuzzleRequest class getObjectFromBodyOrArgs() method
---

# getObjectFromBodyOrArgs

<SinceBadge version="2.20.1" />

Gets an object parameter, from the request body or from the request arguments depending on how the request was sent:

- with the HTTP protocol and the `GET` verb, there is no body: the parameter is read from the request arguments (the query string) as a JSON string, and parsed;
- otherwise, the parameter is read from the request body, as with [getBodyObject](/core/2/framework/classes/kuzzle-request/get-body-object).

This lets an action accept the same parameter from a `GET` route and from a `POST` route.

Throws an `api.assert.missing_argument` error if the parameter is not set and no default value is provided, and an `api.assert.invalid_type` error if it is not an object or not a valid JSON string.

### Arguments

```ts
getObjectFromBodyOrArgs (name: string, def?: JSONObject): JSONObject
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>JSONObject</pre> | Default value to return if the parameter is not set |

### Example

```ts
// GET /_/my-controller/search?query={"match_all":{}}
// or POST /_/my-controller/search with the body { "query": { "match_all": {} } }
const query = request.getObjectFromBodyOrArgs('query', {});
```
