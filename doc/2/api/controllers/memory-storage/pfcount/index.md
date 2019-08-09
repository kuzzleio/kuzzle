---
code: true
type: page
title: pfcount
---

# pfcount



Returns the probabilistic cardinality of a [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) data structure, or of the merged HyperLogLog structures if more than 1 is provided (see [pfadd](/core/2/api/controllers/memory-storage/pfadd)).

[[_Redis documentation_]](https://redis.io/commands/pfcount)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pfcount?keys=key1,key2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pfcount",
  "keys": ["key1", "key2", "..."]
}
```

---

## Argument

- `keys`: hyperloglog key identifiers

---

## Response

Returns the probabilistic cardinality.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pfcount",
  "collection": null,
  "index": null,
  "result": 6
}
```
