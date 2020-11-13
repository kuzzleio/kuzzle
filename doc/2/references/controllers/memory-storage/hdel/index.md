---
code: true
type: page
title: hdel
---

# hdel



Removes fields from a hash.

[[_Redis documentation_]](https://redis.io/commands/hdel)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hdel/<_id>
Method: DELETE
Body:
```

```js
{
  "fields": ["field1", "field2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hdel",
  "_id": "<key>",
  "body": {
    "fields": ["field1", "field2", "..."]
  }
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Body properties

- `fields`: an array of hash fields to delete

---

## Response

Returns the number of removed fields.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hdel",
  "collection": null,
  "index": null,
  "result": 3
}
```
