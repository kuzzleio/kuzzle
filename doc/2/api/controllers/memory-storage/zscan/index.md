---
code: true
type: page
title: zscan | API | Core
---

# zscan



Iterates incrementally over members contained in a sorted set, using a cursor.

An iteration starts when the cursor is set to 0.  
To get the next page of results, simply re-send the request with the updated cursor position provided in the result set.

The scan ends when the cursor returned by the server is 0.

[[_Redis documentation_]](https://redis.io/commands/sscan)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zscan/<_id>?cursor=<cursor>[&match=<pattern>][&count=<count>]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zscan",
  "_id": "<key>",
  "cursor": "<cursor>",
  // optional
  "match": "<pattern>",
  "count": "<count>"
}
```

---

## Arguments

- `_id`: sorted set identifier
- `cursor`: cursor offset

### Optional:

- `count`: return an _approximate_ number of items per result set (the default is 10)
- `match`: search only keys matching the provided pattern

---

## Response

Returns an array containing the following two elements:

- a new cursor position, to be used to get the next page of results (or `0` when at the end of the cursor)
- an array of values alternating between sorted set elements and their associated score

### Example

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zscan",
  "collection": null,
  "index": null,
  "result": [
    21,
    [
      "element1",
      "score of element1",
      "element2",
      "score of element2",
      "..."
    ]
  ]
}
```
