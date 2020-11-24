---
code: true
type: page
title: searchProfiles
---

# searchProfiles



Searches security profiles, optionally returning only those linked to the provided list of security roles.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/_search[?from=0][&size=42][&scroll=<time to live>]
Method: POST
Body:
```

```js
{
  "roles": [
    "role1",
    "admin"
  ]
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchProfiles",
  "body": {
    "roles": [
      "role1",
      "admin"
    ]
  },
  // optional: result pagination configuration
  "from": 0,
  "size": 42,
  "scroll": "<ttl>"
}
```

---

## Arguments

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `scroll`: create a new forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed. If set, a cursor identifier named `scrollId` will be returned in the results. This cursor can then be moved forward using the [scrollProfiles](/core/2/api/controllers/security/scroll-profiles) API action
- `size`: the maximum number of profiles returned in one response page

---

## Body properties

### Optional:

- `roles`: an array of role identifiers. Restrict the search to profiles linked to the provided roles.

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found profile:
  - `_id`: profile identifier
  - `_source`: profile definition
- `total`: total number of profiles found. Depending on pagination options, this can be greater than the actual number of profiles in a single result page

```js
{
  "status": 200,
  "error": null,
  "result":
  {
    "hits": [
      {
        "_id": "firstProfileId",
        "_source": {
          // Full profile definition
        }
      },
      {
        "_id": "secondProfileId",
        "_source": {
          // Full profile definition
        }
      }
    ],
    "total": 2
  },
  "action": "searchProfiles",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
