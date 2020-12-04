---
code: true
type: page
title: getCredentialFields
---

# getCredentialFields



Retrieves the list of accepted field names by the specified authentication strategy.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/_fields
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getCredentialFields",
  "strategy": "<strategy>"
}
```

---

## Arguments

- `strategy`: authentication strategy

---

## Response

Returns an array of accepted field names.

### Example with the "local" authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "getCredentialFields",
  "controller": "security",
  "result": ["username", "password"]
}
```
