---
code: true
type: page
title: removeHeader | Framework | Core

description: RequestResponse class removeHeader() method
---

# removeHeader

<SinceBadge version="2.11.0" />

Removes a response header. Header names are case-insensitive.

Returns `true`, whether or not the header was set.

### Arguments

```ts
removeHeader (name: string): any
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Header name |

### Example

```ts
request.response.removeHeader('X-Custom-Header');
```
