---
code: true
type: page
title: hincrby
---

# hincrby



Increments the number stored in a hash field by the provided integer value.

[[_Redis documentation_]](https://redis.io/commands/hincrby)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hincrby/<_id>
Method: POST
Body:
```

```js
{
  "field": "field name",
  "value": <increment integer value>
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hincrby",
  "_id": "<key>",
  "body": {
    "field": "field name",
    "value": <increment integer value>
  }
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Body properties

- `field`: the hash field to increment
- `value`: the integer to add to the field value

---

## Response

Returns the updated value for the incremented hash field.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hincrby",
  "collection": null,
  "index": null,
  "result": 42
}
```
