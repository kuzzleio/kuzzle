---
code: true
type: page
title: getHeader | Framework | Core

description: RequestResponse class getHeader() method
---

# getHeader

<SinceBadge version="2.11.0" />

Returns the value of a response header. Header names are case-insensitive.

Returns `undefined` if the header is not set.

### Arguments

```ts
getHeader (name: string): string | null
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Header name |

### Example

```ts
request.response.setHeader('Content-Type', 'text/plain');

request.response.getHeader('content-type');
// "text/plain"
```
