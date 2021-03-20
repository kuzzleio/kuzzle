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

| Name | Type | Description                      | Default |
|------|------|----------------------------------|---------|
| `headers` | <pre>JSONObject</pre> | Additional response protocol headers | `null` |
| `status` | <pre>integer</pre> | KuzzleRequest status code, following the HTTP standard | `200` |
| `format` | <pre>string</pre> | The response format, as a `standard` Kuzzle response or in a unwrapped `raw` format instead | `null` |

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
