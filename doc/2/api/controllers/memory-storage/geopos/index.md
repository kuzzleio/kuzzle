---
code: true
type: page
title: geopos
---

# geopos



Returns the position (`[longitude, latitude]`) of the provided key's members (see [geoadd](/core/2/api/controllers/memory-storage/geoadd)).

[[_Redis documentation_]](https://redis.io/commands/geopos)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_geopos/<_id>?members=member1,member2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "geopos",
  "_id": "<key>",
  "members": ["member1", "member2", "..."]
}
```

---

## Arguments

- `_id`: key containing the geopoints to fetch
- `members`: list of geopoint names to fetch

---

## Response

Returns the members positions (`[longitude, latitude]`), in the same order than the one provided in the query.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "geopos",
  "collection": null,
  "index": null,
  "result": [
    [3.9109057, 43.6073913],
    [3.897105, 43.6002203],
    [3.948711, 43.5764455]
  ]
}
```
