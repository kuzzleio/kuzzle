---
code: true
type: page
title: getSettings | API | Core
---

# getSettings

Retrieves the Elasticsearch index settings for the specified Kuzzle collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_settings
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "getSettings",
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a setting object with the following structure:

```js
{
  "status": 200,
  "error": null,
  "action": "getSettings",
  "controller": "collection",
  "collection": "<collection>",
  "index": "<index>",
  "headers": {},
  "result": {
    "routing": {
      "allocation": {
        "include": {
          "_tier_preference": "data_content"
        }
      }
    },
    "number_of_shards": "1",
    "provided_name": "&platform.config",
    "creation_date": "1738682329397",
    "number_of_replicas": "1",
    "uuid": "aY0IBbKJSvuIrwqqYyKkUw",
    "version": {
      "created": "7160299"
    }
  },
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)
