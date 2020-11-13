---
code: true
type: page
title: geodist
---

# geodist



Returns the distance between two geospatial members of a key (see [geoadd](/core/2/api/controllers/memory-storage/geoadd)).

The returned distance is expressed in meters by default.

[[_Redis documentation_]](https://redis.io/commands/geodist)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_geodist/<_id>/<member1>/<member2>[?unit=[m|km|mi|ft]]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "geodist",
  "_id": "<key>",
  "member1": "first member name",
  "member2": "second member name",
  "unit": "ft"
}
```

---

## Arguments

- `_id`: key containing the geopoints to compare
- `member1`: first geopoint name
- `member2`: second geopoint name

### Optional:

- `unit`: the unit used for the returned calculated distance. Accepted values: `m`, `km`, `mi`, `ft`

---

## Response

Returns the calculated distance.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "geodist",
  "collection": null,
  "index": null,
  "result": 192.3
}
```
