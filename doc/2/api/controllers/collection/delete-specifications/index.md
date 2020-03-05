---
code: true
type: page
title: deleteSpecifications
---

# deleteSpecifications



Deletes validation specifications for a collection.

The request succeeds even if no specification exist for that collection.

**_Note:_** an empty specification is implicitly applied to all collections. In a way, "no specification set" means "all documents are valid".

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_specifications
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "deleteSpecifications",
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a confirmation that the specifications are deleted:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "deleteSpecifications",
  "controller": "collection",
  "result": true
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)

