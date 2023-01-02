---
code: true
type: page
title: rpushx | API | Core
---

# rpushx



Appends a value at the end of a list, only if the destination key already exists, and if it holds a list.

[[_Redis documentation_]](https://redis.io/commands/rpushx)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_rpushx/<_id>
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
  "action": "rpushx",
  "_id": "<key>",
  "body": {
    "value": "<value>"
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `value`: the value to push to the list

---

## Response

Returns the updated list length.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "rpushx",
  "collection": null,
  "index": null,
  "result": 12
}
```
