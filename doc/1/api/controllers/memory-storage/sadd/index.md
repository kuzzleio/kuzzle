---
code: true
type: page
title: sadd
---

# sadd



Adds members to a set of unique values stored at `key`.

If the destination set does not exist, it is created beforehand.

[[_Redis documentation_]](https://redis.io/commands/sadd)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sadd/<_id>
Method: POST
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
  "action": "sadd",
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

- `members`: an array of values to add to the set

---

## Response

Returns the number of elements successfully added to the set.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sadd",
  "collection": null,
  "index": null,
  "result": 2
}
```
