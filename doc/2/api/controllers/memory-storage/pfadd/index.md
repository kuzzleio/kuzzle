---
code: true
type: page
title: pfadd
---

# pfadd



Adds elements to a [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) data structure.

[[_Redis documentation_]](https://redis.io/commands/pfadd)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pfadd/<_id>
Method: POST
Body:
```

```js
{
  "elements": ["element1", "element2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pfadd",
  "_id": "<key>",
  "body": {
    "elements": ["element1", "element2", "..."]
  }
}
```

---

## Argument

- `_id`: hyperloglog key identifier

---

## Body properties

- `elements`: an array of values to add to the hyperloglog structure

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pfadd",
  "collection": null,
  "index": null,
  "result": 1
}
```
