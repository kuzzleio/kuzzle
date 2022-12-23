---
code: true
type: page
title: list | API | Core
---

# list

Returns the complete list of indexes.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_list[?countCollections]
Method: GET
```

### Other protocols

```js
{
  "controller": "index",
  "action": "list",

  "countCollection": true
}
```

---

## Arguments

### Optional:

- `countCollections`: if set to true, will returns the number of collections in each index

---

## Response

Returns an object containing an `indexes` array containing the indexes names.  

If the `countCollections` argument has been set to `true`, then the object contains an `collections` object containing the number of collection in each index.

```js
{
  "status": 200,
  "error": null,
  "controller": "index",
  "action": "list",
  "requestId": "<unique request identifier>",
  "result": {
    "indexes": [
      "index_1",
      "index_2",
      "index_...",
      "index_n"
    ],

    // only when countCollections is set to true
    "collections": {
      "index_1": 42,
      "index_2": 21
    }
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)

