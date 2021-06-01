---
code: true
type: page
title: checkRights
---

# checkRights

<SinceBadge version="auto-version"/>

Checks if the provided API request can be executed by a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>/_checkRights
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
    "controller": "server",
    "action": "info"
  }
}
```

### Other protocols

```js
{
  "controller": "user",
  "action": "checkRights",
  "_id": "<kuid>",
  "body": {
    // RequestPayload
    "controller": "document",
    "action": "create",
    "index": "nyc-open-data",
    "collection": "yellow-taxi",
    "body": {
      "name": "melis"
    }
  }
}
```

---

## Arguments

- `_id`: user unique [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

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
  "controller": "user",
  "action": "checkRights",
  "requestId": "<unique request identifier>",
  "result": {
    "allowed": true
  }
}
```
