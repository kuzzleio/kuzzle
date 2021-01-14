---
code: true
type: page
title: checkRights
---

# checkRights

<SinceBadge version="2.8.0"/>

Checks if the provided API request can be executed by this network connection, using the current authentication information.

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
  // RequestPayload
  "controller": "document",
  "action": "create",
  "index": "nyc-open-data",
  "collection": "yellow-taxi",
  "body": {
    "name": "Melis"
  }
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "checkRights",
  "body": {
    // RequestPayload
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

---

## Body properties

The body must contain a [RequestPayload](/core/2/api/payloads/request) with at least the following properties:

- `controller`: API controller
- `action`: API action

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
