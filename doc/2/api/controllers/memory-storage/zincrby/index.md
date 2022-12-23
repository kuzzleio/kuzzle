---
code: true
type: page
title: zincrby | API | Core
---

# zincrby



Increments the score of a sorted set member by the provided value.

[[_Redis documentation_]](https://redis.io/commands/zincrby)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zincrby/<_id>
Method: POST
Body:
```

```js
{
  "member": "<member>",
  "value": <integer>
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zincrby",
  "_id": "<key>",
  "body": {
    "member": "<member>",
    "value": <integer>
  }
}
```

---

## Arguments

- `_id`: sorted set identifier

---

## Body properties

- `member`: sorted set value
- `value`: integer value used to increment the member's score

---

## Response

Returns the updated member's score value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zincrby",
  "collection": null,
  "index": null,
  "result": 26
}
```
