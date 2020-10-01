---
code: true
type: page
title: swagger
---

# swagger


Returns available API routes Swagger specifications, including both Kuzzle's and plugins'.  

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_swagger[?format=<json|yaml>]
Method: GET
```

::: warning
The YAML response format is only available using the HTTP protocol. 
Using other protocols like WebSocket or MQTT, the response will always be JSON formatted.
:::

### Other protocols

```js
{
  "controller": "server",
  "action": "swagger",
}
```

---

## Response

Returns the Swagger specifications JSON (by default) or YAML formatted.

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
