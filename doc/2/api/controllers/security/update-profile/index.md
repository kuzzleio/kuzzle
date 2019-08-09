---
code: true
type: page
title: updateProfile
---

# updateProfile



Updates a security profile definition.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/<_id>/_update[?refresh=wait_for]
Method: PUT
Body:
```

```js
{
    "policies": [
      {
        "roleId": "<roleId>"
      },
      {
        "roleId": "<roleId>",
        "restrictedTo": [
          {
            "index": "<index>"
          },
          {
            "index": "<index>",
            "collections": [
              "<coll1>",
              "<coll2>"
            ]
          }
        ]
      }
    ]
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "updateProfile",
  "_id": "<profileId>",
  "body": {
    "policies": [
      {
        "roleId": "<roleId>"
      },
      {
        "roleId": "<roleId>",
        "restrictedTo": [
          {
            "index": "<index>"
          },
          {
            "index": "<index>",
            "collections": [
              "<coll1>",
              "<coll2>"
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Arguments

- `_id`: profile identifier

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the profile changes are indexed

---

## Body properties

- `policies`: [profile definition](/core/2/guides/essentials/security#defining-profiles)

---

## Response

Returns the updated profile identifier and version number.

```js
{
  "status": 200,
  "error": null,
  "action": "updateProfile",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<profileId>",
    "_version": 2
  }
}
```
