---
code: true
type: page
title: mDelete
---

# mDelete



Deletes multiple indexes.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_mDelete
Method: DELETE
Body:
```

```js
{
  indexes: ['index 1', 'index 2', 'index ...'];
}
```

### Other protocols

```js
{
  "controller": "index",
  "action": "mDelete",
  "body": {
    "indexes": [
      "index 1",
      "index 2",
      "index ..."
    ]
  }
}
```

---

## Body properties

If no index is specified in the body, then all indexes that the current user is allowed to delete will be removed.

### Optional:

- `indexes`: an array of index names to delete

---

## Response

Returns an array of indexes that were actually deleted.

```js
{
  "status": 200,
  "error": null,
  "action": "mDelete",
  "controller": "index",
  "requestId": "<unique request identifier>",
  "result": {
    "deleted":[
      "index1",
      "index2"
    ]
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)

