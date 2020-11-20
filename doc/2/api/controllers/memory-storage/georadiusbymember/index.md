---
code: true
type: page
title: georadiusbymember
---

# georadiusbymember



Returns the members (added with [geoadd](/core/2/api/controllers/memory-storage/geoadd)) of a given key inside the provided geospatial radius, centered around one of a key's member.

[[_Redis documentation_]](https://redis.io/commands/georadiusbymember)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_georadiusbymember/<_id>?member=<member>&distance=<distance>&unit=[m|km|mi|ft][&options=option1,option2,...]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "georadiusbymember",
  "_id": "<key>",
  "member": "kuzzle HQ",
  "distance": "1500"
  "unit": "m"
}
```

---

## Arguments

- `_id`: key containing the geopoints to fetch
- `distance`: distance from the center of the radius
- `member`: name of the point used as the radius center
- `unit`: unit of the `distance` parameter value. Allowed values: `m`, `km`, `mi`, `ft`

### Optional:

- `options`: an array of one or multiple of the following values: `withcoord`, `withdist`, `count <count>`, `asc` and `desc`
- `asc`: sort the results in ascending order (from the nearest member to the farthest one)
- `count`: limit the number of returned results. The count value must be passed as a separate option (HTTP: `&options=count,<count value>`, Other protocols: `options: ['count', <count value>]`)
- `desc`: sort the results in descending order (from the farthest member to the nearest one)
- `withcoord`: include the position of the matched geopoint, in the following format: `[longitude, latitude]`
- `withdist`: include the calculated distance from the matched geopoint to the radius center

---

## Response

The response format depends on the passed options.

Without neither `withcoord` nor `withdist`, the response consists only of a list of points names:

```js
{
 "requestId": "<unique request identifier>",
 "status": 200,
 "error": null,
 "controller": "ms",
 "action": "georadiusbymember",
 "collection": null,
 "index": null,
 "result": [
    "our other HQ",
    "kuzzle HQ"
 ]
}
```

With the `withcoord` option, points coordinates are included to the response (format: `[longitude, latitude]`):

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "georadiusbymember",
  "collection": null,
  "index": null,
  "result": [
    [
      "our other HQ",
      [
        "3.89710754156112671",
        "43.60022152617014513"
      ]
    ],
    [
      "kuzzle HQ",
      [
        "3.91090482473373413",
        "43.607392252329916"
      ]
    ]
  ]
}
```

With the `withdist` option, the distance from the queried radius center is added to the response. The unit used for that distance is the same one than the one provided to the `unit` argument:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "georadius",
  "collection": null,
  "index": null,
  "result": [
    [
      "our other HQ",
      "1367.8521"
    ],
    [
      "kuzzle HQ",
      "0.0000"
    ]
  ]
}
```

With both the `withcoord` and the `withdist` options:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "georadiusbymember",
  "collection": null,
  "index": null,
  "result": [
    [
      "our other HQ",
      "1367.8521",
      [
        "3.89710754156112671",
        "43.60022152617014513"
      ]
    ],
    [
      "kuzzle HQ",
      "0.0000",
      [
        "3.91090482473373413",
        "43.607392252329916"
      ]
    ]
  ]
}
```
