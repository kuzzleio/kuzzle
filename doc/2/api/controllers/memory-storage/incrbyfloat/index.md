---
code: true
type: page
title: incrbyfloat | API | Core
---

# incrbyfloat



Increments the number stored at `key` by the provided float value. If the key does not exist, it is set to 0 before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/incrbyfloat)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_incrbyfloat/<_id>
Method: POST
Body:
```

```js
{
  "value": <increment float value>
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "incrbyfloat",
  "_id": "<key>",
  "body": {
    "value": <increment float value>
  }
}
```

---

## Arguments

- `_id`: key identifier

---

## Body properties

- `value`: the float value to add to the key value

---

## Response

Returns the incremented float value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "incrbyfloat",
  "collection": null,
  "index": null,
  "result": "3.1415"
}
```
