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
  }): void;
```

</br>

The `options` object may contain the following properties:

| Name | Type | Description<br/>(default)        |
|------|------|----------------------------------|
| `headers` | <pre>JSONObject</pre>(`null`) | Additional response protocol headers |
| `status` | <pre>integer</pre>(`200`) | KuzzleRequest status code, following the HTTP standard |
| `format` | <pre>string</pre>(`null`) | The response format, as a `standard` Kuzzle response or in a unwrapped `raw` format instead |
| `result` | <pre>any</pre> | <SinceBadge version="auto" /> The response result. Set only when the property is present (`result: null` clears it). Unlike [setResult](/core/2/framework/classes/kuzzle-request/set-result), it does not reset the status: without a `status` option, a pending `102` becomes `200` and any other status is kept |

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
