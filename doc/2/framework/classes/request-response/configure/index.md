---
code: true
type: page
title: configure
description: RequestResponse class configure() method
---

# configure

<SinceBadge version="auto-version" />

Allows to directly set internal configuration options.

### Arguments

```ts
configure(
  options: {
    headers?: JSONObject,
    status?: number,
    format?: 'standard' | 'raw'
  }): void;
```

</br>

The `options` object may contain the following properties:

| Name | Type | Description<br/>(default)        |
|------|------|----------------------------------|
| `headers` | <pre>JSONObject</pre>(`null`) | Additional response protocol headers |
| `status` | <pre>integer</pre>(`200`) | KuzzleRequest status code, following the HTTP standard |
| `format` | <pre>string</pre>(`null`) | The response format, as a `standard` Kuzzle response or in a unwrapped `raw` format instead |

### Example

```js
request.response.configure({
  headers: {
    'Location': 'http://kuzzle.io'
  },
  status: 302,
  format: 'raw',
});
```
