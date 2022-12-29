---
code: true
type: page
title: linsert | API | Core
---

# linsert



Inserts a value in a list, either before or after a pivot value.

[[_Redis documentation_]](https://redis.io/commands/linsert)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_linsert/<_id>
Method: POST
Body:
```

```js
{
  "position": "[before|after]",
  "pivot": "<pivot value>",
  "value": "<value to insert>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "linsert",
  "_id": "<key>",
  "body": {
    "position": "[before|after]",
    "pivot": "<pivot value>",
    "value": "<value to insert>"
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `position`: tell whether the value is to be inserted before or after the pivot value. Accepted values: `before`, `after`
- `pivot`: value in the list used as a pivot
- `value`: new value to insert in the list

---

## Response

Returns the updated length of the list.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "linsert",
  "collection": null,
  "index": null,
  "result": 7
}
```
