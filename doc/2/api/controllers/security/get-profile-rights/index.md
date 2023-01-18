---
code: true
type: page
title: getProfileRights | API | Core
---

# getProfileRights



Gets the detailed rights configured by a security profile.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_profiles/<_id>/_rights
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getProfileRights",
  "_id": "<profileId>"
}
```

---

## Arguments

- `_id`: profile identifier

---

## Response

Returns a `hits` array of objects. Each object is a security right described by the security profile:

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
    // An array of objects containing the profile rights
    "hits": [
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
