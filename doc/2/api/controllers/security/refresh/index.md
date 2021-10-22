---
code: true
type: page
title: refresh
---

# refresh

<SinceBadge version="2.1.0"/>

Forces an immediate [reindexation](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-refresh.html) of the provided security collection.

The available security collections are: `users`, `profiles`, `roles`.

When writing or deleting documents in Kuzzle, the changes need to be indexed before being reflected in the search results.
By default, this operation can take up to 1 second.

::: warning
Forcing immediate refreshes comes with performance costs, and should only performed when absolutely necessary.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_security/<collection>/_refresh
Method: POST
```

### Other protocols

```js
{
  "collection": "<collection>",
  "controller": "security",
  "action": "refresh"
}
```

---

## Arguments

- `collection`: collection name to refresh

---

## Response

Returns a response with `status` 200 if the refresh succeeds.

```js
{
  "status": 200,
  "error": null,
  "collection": "<collection>",
  "controller": "security",
  "action": "refresh",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
