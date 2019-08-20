---
code: true
type: page
title: spop
---

# spop



Removes and returns one or more elements at random from a set of unique values. If multiple elements are removed, the result set will be an array of removed elements, instead of a string.

[[_Redis documentation_]](https://redis.io/commands/spop)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_spop/<_id>
Method: POST
Body:
```

```js
{
  // optional
  "count": 2
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "spop",
  "_id": "<key>",
  "body": {
    // optional
    "count": 2
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

### Optional:

- `count`: number of elements to remove (default: `1`)

---

## Response

If `count` is not set or equal to `1`, returns the removed element as a string:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "spop",
  "collection": null,
  "index": null,
  "result": "<removed element>"
}
```

If multiple elements are removed (`count > 1`), an array of removed elements is returned instead:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "spop",
  "collection": null,
  "index": null,
  "result": [
    "removed element 1",
    "removed element 2",
    "..."
  ]
}
```
