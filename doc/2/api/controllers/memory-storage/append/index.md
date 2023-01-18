---
code: true
type: page
title: append | API | Core
---

# append



Appends a value to a key. If the key does not exist, it is created.

[[_Redis documentation_]](https://redis.io/commands/append)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_append/<_id>
Method: POST
Body:
```

```js
{
  "value": "<value>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "append",
  "_id": "<key>",
  "body": {
    "value": "<value>"
  }
}
```

---

## Arguments

- `key`: key to update or create

---

## Body properties

- `value`: the value to append

---

## Response

Returns the updated value length.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "append",
  "collection": null,
  "index": null,
  "result": 42
}
```
