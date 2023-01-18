---
code: true
type: page
title: updateProfile | API | Core
---

# updateProfile

Updates a security profile definition.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/<_id>/_update[?refresh=wait_for][&retryOnConflict=10][&strict]
Method: PUT
Body:
```

```js
{
  "rateLimit": 50,
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
    "rateLimit": 50,
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
  },
  // Optional
  "refresh": "wait_for",
  "retryOnConflict": 10,
  "strict": true
}
```

---

## Arguments

- `_id`: profile identifier

### Optional arguments

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user changes are indexed (default: `"wait_for"`)
- `retryOnConflict`: in case of an update conflict in Elasticsearch, the number of retries before aborting the operation (default: `10`)
- `strict` (default: `false`): if set to true, will only allow the profile to be restricted on existing indexes or collections <SinceBadge version="2.6.0"/>

---

## Body properties

See the [profile definition guide](/core/2/guides/main-concepts/permissions#profiles).

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
