---
code: true
type: page
title: rpush
---

# rpush



Appends values at the end of a list.

If the destination list does not exist, it is created holding an empty list before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/rpush)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_rpush/<_id>
Method: POST
Body:
```

```js
{
  "values": ["value1", "value2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "rpush",
  "_id": "<key>",
  "body": {
    "values": ["value1", "value2", "..."]
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `values`: an array of values to push to the list

---

## Response

Returns the updated list length.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "rpush",
  "collection": null,
  "index": null,
  "result": 12
}
```
