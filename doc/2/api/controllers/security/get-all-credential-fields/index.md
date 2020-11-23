---
code: true
type: page
title: getAllCredentialFields
---

# getAllCredentialFields



Retrieves the list of fields accepted by authentication strategies.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/_fields
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getAllCredentialFields"
}
```

---

## Response

Returns an object with a property per authentication strategy, pointing to an array of accepted field names.

```js
{
  "status": 200,
  "error": null,
  "action": "getAllCredentialFields",
  "controller": "security",
  "result": {
    "local": ["username", "password"],
    "facebook": []
  }
}
```
