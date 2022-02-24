---
code: true
type: page
title: openapi
---

# openapi


Returns available API routes OpenAPI v3 specifications.

By default, the action returns Kuzzle standard API specification, to return the custom specification from the plugins and application, the scope parameter should be `app`.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_openapi[?format=<json|yaml>][scope=<app|kuzzle>]
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "openapi",
  "format": "<json|yaml>",
  "scope": "<kuzzle|app",
}
```

---

## Response

Returns the OpenAPI v3 specifications JSON (by default) or YAML formatted.

* JSON format:
```js
{
  "openapi": "3.0.1",
  "info": {
    "title":"Kuzzle API",
    "description":"The Kuzzle HTTP API",
    "contact": {
      "name":"Kuzzle team",
      "url":"http://kuzzle.io",
      "email":"hello@kuzzle.io"
    },
    "license": {
      "name":"Apache 2",
      "url":"http://opensource.org/licenses/apache2.0"
    },
    "version":"2.4.5"
  },
  // ...
}
```

* YAML format:
```yaml
openapi: 3.0.1
info:
  title: Kuzzle API
  description: The Kuzzle HTTP API
  contact:
    name: Kuzzle team
    url: http://kuzzle.io
    email: hello@kuzzle.io
  license:
    name: Apache 2
    url: http://opensource.org/licenses/apache2.0
  version: 2.4.5
# ...
```
