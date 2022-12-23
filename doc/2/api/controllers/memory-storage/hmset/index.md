---
code: true
type: page
title: hmset | API | Core
---

# hmset



Sets multiple fields at once in a hash.

[[_Redis documentation_]](https://redis.io/commands/hmset)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hmset/<_id>
Method: POST
Body:
```

```js
{
  "entries": [
    {"field": "<field1 name>", "value": "<field1 value>"},
    {"field": "<field2 name>", "value": "<field2 value>"},
    {"field": "<...>", "value": "<...>"}
  ]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hmset",
  "_id": "<key>",
  "body": {
    "entries": [
      {"field": "<field1 name>", "value": "<field1 value>"},
      {"field": "<field2 name>", "value": "<field2 value>"},
      {"field": "<...>", "value": "<...>"}
    ]
  }
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Body properties

- `entries`: an array of objects. Each object describes a new hash field to set, with the following properties:
  - `field`: hash field name
  - `value`: hash field value

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hmset",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
