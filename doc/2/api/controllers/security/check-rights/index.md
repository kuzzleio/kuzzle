---
code: true
type: page
title: checkRights
---

# checkRights

<SinceBadge version="2.8.0"/>
<DeprecatedBadge version="auto-version">

__Use [user:checkRights](/core/2/api/controllers/user/check-rights) instead.__

Checks if the provided API request can be executed by a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_checkRights/<_id>
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
  "controller": "security",
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
  "controller": "security",
  "action": "checkRights",
  "requestId": "<unique request identifier>",
  "result": {
    "allowed": true
  }
}
```
