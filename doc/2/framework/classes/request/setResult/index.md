---
code: true
type: page
title: setResult
description: Request class setResult() method
---

# setResult

Sets the request result and status

### Arguments

```ts
setResult(
  result: any,
  options: {
    status?: number
    headers?: JSONObject;
    raw?: boolean;
  }): void;
```

</br>

| Name | Type | Description                      |
|------|------|----------------------------------|
| `result` | <pre>any</pre> | Request result. Will be converted to JSON unless `raw` option is set to `true` |
| `options` | <pre>JSONObject</pre> | Optional parameters |

The `options` argument may contain the following properties:

| Name | Type | Description                      | Default |
|------|------|----------------------------------|---------|
| `status` | <pre>integer</pre> | HTTP status code | `200` |
| `headers` | <pre>JSONObject</pre> | Additional response protocol headers | `null` |
| `raw` | <pre>boolean</pre> | Instead of a Kuzzle response, forward the result directly | `false` |

If a `KuzzleError` is provided, the request's status attribute is set to the error one.

Otherwise, the provided error is encapsulated into an `InternalError` object, and the request's status is set to 500.

### Example

```ts
request.setResult(null, {
  raw: true,
  // HTTP status code for redirection
  status: 302,
  headers: {
    'Location': 'http://kuzzle.io'
  }
})
```