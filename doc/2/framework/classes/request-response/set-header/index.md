---
code: true
type: page
title: setHeader | Framework | Core

description: RequestResponse class setHeader() method
---

# setHeader

<SinceBadge version="2.11.0" />

Sets a response header, with the same behavior as Node.js [response.setHeader](https://nodejs.org/api/http.html#responsesetheadername-value). Header names are case-insensitive.

If the header is already set:
- standard single-value headers (`Content-Type`, `Content-Length`, `Authorization`, `ETag`, `Expires`, `Retry-After`, `User-Agent`...) are overwritten;
- `Set-Cookie` values are added to an array;
- any other value is appended to the existing one, separated by `, `.

The value is converted to a string. Returns `true`.

### Arguments

```ts
setHeader (name: string, value: string): any
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Header name |
| `value` | <pre>string</pre> | Header value |

### Example

```ts
request.response.setHeader('Cache-Control', 'no-cache');
request.response.setHeader('Cache-Control', 'no-store');

request.response.getHeader('cache-control');
// "no-cache, no-store"
```
