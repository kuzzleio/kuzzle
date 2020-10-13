---
code: true
type: page
title: createProfile
---

# createProfile

Creates a new profile.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/<_id>/_create[?refresh=wait_for][&force]
Method: POST
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
  "action": "createProfile",
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
  // Optional parameters
  "force": true,
  "refresh": "wait_for"
}
```

---

## Arguments

- `_id`: new profile identifier. An error is returned if the profile already exists

### Optional:

- `force` (default: `false`): if set to true, will allow the profile to be restricted on non-existing indexes or collections <SinceBadge version="auto-version"/>
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created profile is indexed (default: `"wait_for"`)

---

## Body properties

See the [profile definition guide](/core/2/guides/essentials/security#defining-profiles).

---

## Response

Returns an object with the new profile creation status:

- `_id`: created profile identifier
- `_source`: profile content
- `created`: always `true`
- `version`: always `1`

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<profileId>",
    "_version": 1,
    "created": true,
    "_source": {
      // new profile content
    }
  },
  "requestId": "<unique request identifier>",
  "controller": "security",
  "action": "createProfile"
}
```
