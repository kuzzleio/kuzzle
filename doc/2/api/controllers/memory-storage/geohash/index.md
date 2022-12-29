---
code: true
type: page
title: geohash | API | Core
---

# geohash



Converts a key's geopoints (see [geoadd](/core/2/api/controllers/memory-storage/geoadd)) into [geohashes](https://en.wikipedia.org/wiki/Geohash).

[[_Redis documentation_]](https://redis.io/commands/geohash)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_geohash/<_id>?members=member1,member2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "geohash",
  "_id": "<key>",
  "members": ["member1", "member2", "..."]
}
```

---

## Arguments

- `_id`: key containing the geopoints to convert
- `members`: list of geopoint names to convert

---

## Response

Returns the converted geohashes, in the same order than the one provided in the query.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "geohash",
  "collection": null,
  "index": null,
  "result": ["geohash1", "geohash2", "..."]
}
```
