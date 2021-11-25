---
code: true
type: page
title: dump
---

# dump

Asynchronously creates a snapshot of Kuzzle's state.
Depending on the configuration of Kuzzle, this may include the following:

* a coredump of Kuzzle running process
* the current Kuzzle configuration
* server logs
* Node.js binary & properties
* a list of OS properties
* plugins configurations
* usage statistics of the dumped instance

The generated directory can be used to feed a complete report to the support team.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_dump
Method: POST
```

### Other protocols

```js
{
  "controller": "admin",
  "action": "dump"
}
```

---

## Response

Returns an acknowledgement.

```javascript
{
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "dump",
  "result": {
    "acknowledge": true
  }
}
```
