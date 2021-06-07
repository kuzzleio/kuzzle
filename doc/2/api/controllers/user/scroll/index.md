---
code: true
type: page
title: scroll
---

# scroll

<SinceBadge version="auto-version"/>

Moves a result set cursor forward, created by a [user:search](/core/2/api/controllers/user/search) query with the `scroll` argument provided.

Results returned by a `scroll` request reflect the state of the index at the time of the initial search request, like a fixed snapshot. Subsequent changes to documents do not affect the scroll results.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/_scroll/<scrollId>[?scroll=<time to live>]
Method: GET
```

### Other protocols

```js
{
  "controller": "user",
  "action": "scroll",
  "scrollId": "<scrollId>",
  "scroll": "<time to live>"
}
```

---

## Arguments

- `scrollId`: cursor unique identifier, obtained by either a search or a scroll query

### Optional:

- `scroll`: refresh the cursor duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) syntax.

---

## Response

Returns a paginated search result set, with the following properties:

- `hits`: array of found profiles. Each document has the following properties:
  - `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
  - `_source`: user definition
- `scrollId`: identifier to the next page of result. Can be different than the previous one(s)
- `total`: total number of found users. Usually greater than the number of users in a result page

```js
{
  "status": 200,
  "error": null,
  "action": "scroll",
  "controller": "user",
  "requestId": "<unique request identifier>",
  "result": {
    "scrollId": "<new scroll id>",
    "hits": [
      {
        "_id": "kuid1",
        "_source": {
          "profileIds": [{"roleId": "default"}],
          "fullname": "John Doe"
        }
      },
      {
        "_id": "kuid2",
        "_source": {
          "profileIds": [{"roleId": "admin"}],
          "fullname": "Beardy McBeardface"
        }
      }
    ],
    "total": 42
  }
}
```
