---
code: true
type: page
title: getMyRights | API | Core
---

# getMyRights



Returns the exhaustive list of granted or denied rights for the currently logged in user.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me/_rights
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/users/_me/_rights
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```
</DeprecatedBadge>

### Other protocols

```js
{
  "controller": "auth",
  "action": "getMyRights",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)

---

## Response

The result contains a `hits` array, listing the rights for the current user.

Each right is an object with the following properties:

- `controller`: API controller
- `action`: controller's action
- `index`: authorized or denied index
- `collection`: authorized or denied collection
- `value`: one of the following value: `denied`, `allowed`

```js
{
  "status": 200,
  "error": null,
  "result": {
    "hits": [
      {
        "controller": "document",
        "action": "get",
        "index": "foo",
        "collection": "bar",
        "value": "allowed"
      },
      {
        "controller": "document",
        "action": "search",
        "index": "foo",
        "collection": "bar",
        "value": "allowed"
      },
      {
        "controller": "document",
        "action": "write",
        "index": "foo",
        "collection": "bar",
        "value": "denied"
      }
    ]
}
```
