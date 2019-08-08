---
code: true
type: page
title: rpoplpush
---

# rpoplpush



Removes the last element of a list, and pushes it back at the start of another list.

[[_Redis documentation_]](https://redis.io/commands/rpoplpush)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_rpoplpush
Method: POST
Body:
```

```js
{
  "source": "<key>",
  "destination": "<key>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "rpoplpush",
  "body": {
    "source": "<key>",
    "destination": "<key>"
  }
}
```

---

## Body properties

- `destination`: the destination list to push the value into
- `source`: the source list from which the value is popped

---

## Response

Returns the popped/pushed element.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "rpoplpush",
  "collection": null,
  "index": null,
  "result": "<value>"
}
```
