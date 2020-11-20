---
code: true
type: page
title: checkRights
---

# checkRights

Checks if the provided API request can be executed.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_checkRights
Method: POST
Body:
```

```js
{
  "request": {
    "controller": "document",
    "action": "create",
    "index": "nyc-open-data",
    "collection": "yellow-taxi",
    "body": {
      "name": "Melis"
    }
  }
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "checkRights",
  "body": {
    "request": {
      "controller": "document",
      "action": "create",
      "index": "nyc-open-data",
      "collection": "yellow-taxi",
      "body": {
        "name": "Melis"
      }
    }
  }
}
```

---

## Body properties

- `request`: API request to check the rights with

---

## Response

The returned result contains the following property:

- `allowed`: a boolean telling whether the provided request would have been allowed or not

Example:

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "checkRights",
  "requestId": "<unique request identifier>",
  "result": {
    "allowed": true
  }
}
```
