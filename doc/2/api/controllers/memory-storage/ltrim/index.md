---
code: true
type: page
title: ltrim
---

# ltrim



Trims an existing list so that it will contain only the specified range of elements specified.

[[_Redis documentation_]](https://redis.io/commands/ltrim)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_ltrim/<_id>
Method: POST
Body:
```

```js
{
  "start": 0,
  "stop": -1
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "ltrim",
  "_id": "<key>",
  "body": {
    "start": 0,
    "stop": -1
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `start`: start index
- `stop`: end index

The arguments `start` and `stop` can be negative. In that case, the index is calculated from the end of the list, going backward. For instance, `-3` is the third element from the end of the list.

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "ltrim",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
