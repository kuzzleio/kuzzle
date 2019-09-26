---
code: true
type: page
title: refreshInternal
---

# refreshInternal



Forces an immediate [reindexation](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/docs-refresh.html) of Kuzzle internal storage.

When writing or deleting security documents in Kuzzle (users, profiles, roles, and so on), the changes need to be indexed before being reflected in the search results.  
By default, this operation can take up to 1 second.

**Note:** forcing immediate refreshes comes with performance costs, and should only performed when absolutely necessary.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_refreshInternal
Method: POST
```

### Other protocols

```js
{
  "controller": "index",
  "action": "refreshInternal"
}
```

---

## Response

Returns a confirmation that the index is being refreshed:

```js
{
  "status": 200,
  "error": null,
  "controller": "index",
  "action": "refreshInternal",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true
  }
}
```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/handling#common-errors)
