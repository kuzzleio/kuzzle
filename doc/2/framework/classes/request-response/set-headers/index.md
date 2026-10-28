---
code: true
type: page
title: setHeaders | Framework | Core

description: RequestResponse class setHeaders() method
---

# setHeaders

<SinceBadge version="2.11.0" />

Sets several response headers at once, with [setHeader](/core/2/framework/classes/request-response/set-header).

Throws an `api.assert.invalid_type` error if `headers` is not an object.

### Arguments

```ts
setHeaders (headers: JSONObject, ifNotPresent: boolean = false): void
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `headers` | <pre>JSONObject</pre> | Headers to set, as `name: value` pairs |
| `ifNotPresent` | <pre>boolean</pre> | If `true`, only sets the headers that are not already set (default: `false`) |

### Example

```ts
request.response.setHeaders({
  'Cache-Control': 'no-cache',
  'X-Custom-Header': 'value',
});

// Does not change a Content-Type header already set
request.response.setHeaders({ 'Content-Type': 'text/plain' }, true);
```
