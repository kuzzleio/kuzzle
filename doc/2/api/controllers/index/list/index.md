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
URL: http://kuzzle:7512/_list[?countCollection]
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

- `countCollection`: if set to `true`, also returns the number of collections in each index. The argument name is singular: `countCollections` is ignored.

---

## Response

Returns an object containing an `indexes` array containing the indexes names.  

If the `countCollection` argument is set to `true`, the object also contains a `collections` object with the number of collections in each index.

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

    // only when countCollection is set to true
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

