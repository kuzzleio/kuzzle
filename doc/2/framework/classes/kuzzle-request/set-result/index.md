---
code: true
type: page
title: setResult
description: KuzzleRequest class setResult() method
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
| `result` | <pre>any</pre> | KuzzleRequest result. Will be converted to JSON unless the `raw` option is set to `true` |
| `options` | <pre>JSONObject</pre> | Optional parameters |

The `options` argument may contain the following properties:

| Name | Type | Description                      | Default |
|------|------|----------------------------------|---------|
| `status` | <pre>integer</pre> | KuzzleRequest status code, following the HTTP standard | `200` |
| `headers` | <pre>JSONObject</pre> | Additional response protocol headers | `null` |
| `raw` | <pre>boolean</pre> | Instead of a Kuzzle response, forward the result directly to the client, without being converted to an API response payload (can be used to answer in a different format than JSON) | `false` |

### Example

```ts
request.setResult(null, {
  raw: true,
  // HTTP status code for redirection
  status: 302,
  headers: {
    'Location': 'http://kuzzle.io'
  }
});
```
