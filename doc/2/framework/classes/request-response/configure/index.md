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
    headers?: JSONObject;
    status?: number;
    raw?: boolean;
  }): void;
```

</br>

The `options` object may contain the following properties:

| Name | Type | Description                      | Default |
|------|------|----------------------------------|---------|
| `headers` | <pre>JSONObject</pre> | Additional response protocol headers | `null` |
| `status` | <pre>integer</pre> | KuzzleRequest status code, following the HTTP standard | `200` |
| `raw` | <pre>boolean</pre> | Instead of a Kuzzle response, forward the result directly to the client, without being converted to an API response payload (can be used to answer in a different format than JSON) | `false` |

### Example

```js
request.response.configure(
  headers: {
    'Location': 'http://kuzzle.io'
  },
  status: 302,
  raw: true,
);
```
