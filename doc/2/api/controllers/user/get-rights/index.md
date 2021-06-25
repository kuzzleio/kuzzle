---
code: true
type: page
title: getRights
---

# getRights

<SinceBadge version="auto-version"/>

Gets the detailed rights granted to a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>/_rights
Method: GET
```

### Other protocols

```js
{
  "controller": "user",
  "action": "getRights",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

---

## Response

Returns a `rights` array of objects. Each object is a security right granted or denied to the user:

- `controller`: impacted Kuzzle controller
- `action`: impacted controller action
- `index`: index name
- `collection`: collection name
- `value`: tell if access is `allowed` or `denied`.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "rights": [
      {
        "controller": "auth",
        "action": "login",
        "value": "allowed"
      },
      {
        "controller": "document",
        "action": "get",
        "index": "foo",
        "collection": "bar",
        "value": "allowed"
      },
      {
        "controller": "document",
        "action": "create",
        "index": "foo",
        "collection": "bar",
        "value": "denied"
      }
    ]
  }
}
```
