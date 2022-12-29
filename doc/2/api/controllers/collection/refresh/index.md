---
code: true
type: page
title: refresh | API | Core
---

# refresh

<SinceBadge version="2.0.0"/>

Forces an immediate [reindexation](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-refresh.html) of the provided collection.

When writing or deleting documents in Kuzzle, the changes need to be indexed before being reflected in the search results.
By default, this operation can take up to 1 second.

::: warning
Forcing immediate refreshes comes with performance costs, and should only performed when absolutely necessary.
:::

::: info
Use [security:refresh](/core/2/api/controllers/security/refresh) to trigger a refresh on a security collection (`users`, `profiles` or `roles`)
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_refresh
Method: POST
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "refresh"
}
```

---

## Arguments

- `index`: index name to refresh
- `collection`: collection name to refresh

---

## Response

Returns a response with `status` 200 if the refresh succeeds.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "refresh",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)
