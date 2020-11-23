---
code: true
type: page
title: searchRoles
---

# searchRoles



Searches security roles, optionally returning only those allowing access to the provided controllers.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/_search[?from=0][&size=42]
Method: POST
Body:
```

```js
{
  // optional: retrieve only roles giving access to the
  // provided controller names
  "controllers": ["document", "security"]
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchRoles",
  "body": {
    // optional: search for roles allowing access to the provided
    // list of controllers
    "controllers": ["document", "security"]
  },
  // optional: result pagination configuration
  "from": 0,
  "size": 42
}
```

---

## Arguments

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `size`: the maximum number of profiles returned in one response page

---

## Body properties

### Optional:

- `controllers`: an array of controller names. Restrict the search to roles linked to the provided controllers.

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found role:
  - `_id`: role identifier
  - `_source`: role definition
- `total`: total number of roles found. Depending on pagination options, this can be greater than the actual number of roles in a single result page

```js
{
  "action": "searchRoles",
  "controller": "security",
  "error": null,
  "requestId": "<unique request identifier>",
  "result":
  {
    "total": 1,
    "hits": [
      {
        "_id": "<roleId>",
        "_source": {
          "controllers": {
            "*": {
              "actions": {
                "*": true
              }
          }
        }
      }
    ]
  }
  "status": 200
}
```
