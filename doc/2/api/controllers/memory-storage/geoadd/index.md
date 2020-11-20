---
code: true
type: page
title: geoadd
---

# geoadd



Adds geospatial points to the specified key.

[[_Redis documentation_]](https://redis.io/commands/geoadd)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_geoadd/<_id>
Method: POST
Body:
```

```js
{
  "points": [
    {
      "lon": 3.9109057,
      "lat": 43.6073913,
      "name": "kuzzle HQ"
    },
    {
      "lon": 3.897105,
      "lat": 43.6002203,
      "name": "our other HQ"
    }
  ]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "geoadd",
  "_id": "<key>",
  "body": {
    "points": [
      {
        "lon": 3.9109057,
        "lat": 43.6073913,
        "name": "kuzzle HQ"
      },
      {
        "lon": 43.6002203,
        "lat": 3.897105,
        "name": "our other HQ"
      }
    ]
  }
}
```

---

## Arguments

- `_id`: key to update

---

## Body properties

- `points`: an array of objects. Each object describes a geographical point, with the following properties:
  - `lon`: longitude (float)
  - `lat`: latitude (float)
  - `name`: point unique identifier

---

## Response

Returns the number of points added to the key.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "geoadd",
  "collection": null,
  "index": null,
  "result": 2
}
```
