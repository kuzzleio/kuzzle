---
code: true
type: page
title: createOrReplaceProfile
---

# createOrReplaceProfile



Creates a new profile or, if the provided profile identifier already exists, replaces it.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/<_id>[?refresh=wait_for]
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
      "roleId": "<anotherRoleId>",
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
  "action": "createOrReplaceProfile",
  "_id": "<profileId>",
  "body": {
    "policies": [
      {
        "roleId": "<anotherRoleId>"
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

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced profile is indexed

---

## Body properties

- `policies`: [profile definition](/core/1/guides/essentials/security/#defining-profiles)

---

## Response

Returns an object with the new profile modification status:

- `_id`: created/replaced profile identifier
- `_source`: profile content
- `created`: if `true`, the profile has been created. Otherwise, it has been replaced
- `version`: updated version number of the profile

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<profileId>",
    "_version": 1,
    "_source": {
      // new profile content
    }
    "created": true
  },
  "requestId": "<request unique identifier>",
  "controller": "security",
  "action": "createOrReplaceProfile"
}
```
