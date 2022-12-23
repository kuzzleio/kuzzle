---
code: true
type: page
title: scrollProfiles | API | Core
---

# scrollProfiles



Moves a result set cursor forward, created by a [searchProfiles](/core/2/api/controllers/security/search-profiles) query with the `scroll` argument provided.

Results returned by a `scrollProfiles` request reflect the state of the index at the time of the initial search request, like a fixed snapshot. Subsequent changes to documents do not affect the scroll results.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/_scroll/<scrollId>[?scroll=<time to live>]
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "scrollProfiles",
  "scrollId": "<scrollId>",
  "scroll": "<time to live>"
}
```

---

## Arguments

- `scrollId`: cursor unique identifier, obtained by either a searchProfiles or a scrollProfiles query

### Optional:

- `scroll`: refresh the cursor duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) syntax.

---

## Response

Returns a paginated search result set, with the following properties:

- `hits`: array of found profiles. Each document has the following properties:
  - `_id`: profile unique identifier
  - `_source`: profile definition
- `scrollId`: identifier to the next page of result. Can be different than the previous one(s)
- `total`: total number of found profiles. Usually greater than the number of profiles in a result page

```js
{
  "status": 200,
  "error": null,
  "action": "scrollProfiles",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "scrollId": "<new scroll id>",
    "hits": [
      {
        "_id": "profile1",
        "_source": {
          "rateLimit": 0,
          "policies": [
            // list of policies
          ]
        }
      },
      {
        "_id": "profile2",
        "_source": {
          "rateLimit": 50,
          "policies": [
            // list of policies
          ]
        }
      }
    ],
    "total": 42
  }
}
```
