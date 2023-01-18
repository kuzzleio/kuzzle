---
code: true
type: page
title: pfmerge | API | Core
---

# pfmerge



Merges multiple [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) data structures into an unique HyperLogLog structure stored at `_id`, approximating the cardinality of the union of the source structures.

[[_Redis documentation_]](https://redis.io/commands/pfmerge)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pfmerge/<_id>
Method: POST
Body:
```

```js
{
  "sources": ["key1", "key2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pfmerge",
  "_id": "<key>",
  "body": {
    "sources": ["key1", "key2", "..."]
  }
}
```

---

## Argument

- `_id`: hyperloglog destination key

---

## Body properties

- `sources`: an array of hyperloglog keys, used as sources for the merge

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pfmerge",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
