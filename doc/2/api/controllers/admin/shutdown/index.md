---
type: page

code: true
title: shutdown
---

# shutdown

Safely stops a Kuzzle instance after all remaining requests are processed.

In a cluster environment, the shutdown action will be propagated across all nodes.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_shutdown
Method: POST
```

### Other protocols

```js
{
  "controller": "admin",
  "action": "shutdown"
}
```

---

## Response

Returns a confirmation that the command is being executed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "shutdown",
  "collection": null,
  "index": null,
  "result": { "acknowledge": true }
}
```
