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
URL: http://kuzzle:7512/profiles/<_id>/_create[?refresh=wait_for]
Method: POST
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
  "action": "createProfile",
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

- `_id`: new profile identifier. An error is returned if the profile already exists

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created profile is indexed

---

## Body properties

- `policies`: [profile definition](/core/1/guides/essentials/security/#defining-profiles)

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
