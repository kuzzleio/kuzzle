---
code: true
type: page
title: hincrbyfloat | API | Core
---

# hincrbyfloat



Increments the number stored in a hash field by the provided float value.

[[_Redis documentation_]](https://redis.io/commands/hincrbyfloat)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hincrbyfloat/<_id>
Method: POST
Body:
```

```js
{
  "field": "field name",
  "value": <increment float value>
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hincrbyfloat",
  "_id": "<key>",
  "body": {
    "field": "field name",
    "value": <increment float value>
  }
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Body properties

- `field`: the hash field to increment
- `value`: the float to add to the field value

---

## Response

Returns the updated value for the incremented hash field.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hincrbyfloat",
  "collection": null,
  "index": null,
  "result": "3.14159"
}
```

Increments the number stored in a hash field by the provided float value.

[[_Redis documentation_]](https://redis.io/commands/hincrbyfloat)
