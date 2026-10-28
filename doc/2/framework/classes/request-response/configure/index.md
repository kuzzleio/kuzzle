---
code: true
type: page
title: configure | Framework | Core

description: RequestResponse class configure() method
---

# configure

<SinceBadge version="2.11.0" />

Allows to configure how the API response should be sent to the requesting client.


### Arguments

```ts
configure(
  options: {
    headers?: JSONObject,
    status?: number,
    format?: 'standard' | 'raw',
    result?: any
  } = {}): void;
```

</br>

The optional `options` object may contain the following properties:

| Name | Type | Description<br/>(default)        |
|------|------|----------------------------------|
| `headers` | <pre>JSONObject</pre>(`null`) | Additional response protocol headers, added with [setHeaders](/core/2/framework/classes/request-response/set-headers) |
| `status` | <pre>integer</pre> | KuzzleRequest status code, following the HTTP standard. When absent, a pending `102` status becomes `200` and any other status is kept |
| `format` | <pre>string</pre>(`null`) | The response format, as a `standard` Kuzzle response or in a unwrapped `raw` format instead. When absent, the format is left unchanged |
| `result` | <pre>any</pre> | <SinceBadge version="2.57.0" /> The response result. Set only when the property is present (`result: null` clears it). Unlike [setResult](/core/2/framework/classes/kuzzle-request/set-result), it does not reset the status: without a `status` option, a pending `102` becomes `200` and any other status is kept |

### Errors

- an `InternalError` if `result` is an `Error` (use [setError](/core/2/framework/classes/kuzzle-request/set-error) instead);
- an [api.assert.forbidden_stream](/core/2/api/errors/error-codes/api#subdomain-0x0201-assert) error if `result` is an [HttpStream](/core/2/framework/classes/http-stream) and the request does not come from the HTTP protocol.

Both are thrown before anything is changed.

### Example

```js
request.response.configure({
  headers: {
    'Location': 'http://kuzzle.io'
  },
  status: 302,
  format: 'raw',
});

// Set a result without touching the status already set on the request
request.response.configure({ result: { acknowledged: true } });
```
