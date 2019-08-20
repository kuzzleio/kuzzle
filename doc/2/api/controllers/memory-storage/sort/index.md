---
code: true
type: page
title: sort
---

# sort



Sorts and returns elements contained in a list, a set of unique values or a sorted set.  
By default, sorting is numeric and elements are compared by their value, interpreted as double precision floating point number.

[[_Redis documentation_]](https://redis.io/commands/sort)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sort/<_id>
Method: POST
Body:
```

```js
{
  // optional arguments
  "alpha": "[false|true]",
  "by": "<external key pattern>",
  "direction": "[ASC|DESC]",
  "get": ["pattern1", "pattern2", "..."],
  "limit": ["<offset>", "<count>"],
  "store": "<destination key>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sort",
  "_id": "<key>",
  "body": {
    "alpha": "[false|true]",
    "by": "<external key pattern>",
    "direction": "[ASC|DESC]",
    "get": ["pattern1", "pattern2", "..."],
    "limit": ["<offset>", "<count>"],
    "store": "<destination key>"
  }
}
```

---

## Arguments

- `_id`: list, set or sorted set key identifier

---

## Body properties

### Optional:

- `alpha`: perform an alphanumerical sort instead of a numeric one
- `by`: instead of sorting by values directly, sort by values contained in external keys, using a pattern completed by values of the list/set/sorted set to sort
- `direction`: sort in ascendant or descendant order
- `get`: instead of returning the sorted values directly, return the values contained in external keys, using patterns completed by the sorted values
- `limit`: limit the result set to a range of matching elements (similar to _SELECT LIMIT offset, count_ in SQL). Format: `[<offset(int)>, <count(int)>]`
- `store`: instead of returning the result set, store it in a list at `destination` key

---

## Response

Returns the sorted elements.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sort",
  "collection": null,
  "index": null,
  "result": [
    "sorted element1",
    "sorted element2",
    "..."
  ]
}
```
