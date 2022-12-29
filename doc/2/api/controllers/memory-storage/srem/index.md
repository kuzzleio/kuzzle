---
code: true
type: page
title: srem | API | Core
---

# srem



Removes members from a set of unique values.

[[_Redis documentation_]](https://redis.io/commands/srem)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_srem/<_id>
Method: DELETE
Body:
```

```js
{
  "members": ["member1", "member2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "srem",
  "_id": "<key>",
  "body": {
    "members": ["member1", "member2", "..."]
  }
}
```

---

## Argument

- `_id`: set key identifier

---

## Body properties

- `members`: list of member values to remove

---

## Response

Returns the number of removed members.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "srem",
  "collection": null,
  "index": null,
  "result": 3
}
```
