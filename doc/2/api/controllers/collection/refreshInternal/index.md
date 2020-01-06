---
code: true
type: page
title: refresh
---

# refresh

<SinceBadge version="2.1.0"/>

Forces an immediate [reindexation](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-refresh.html) of the provided internal collection.

The default internal collections are: `users`, `profiles`, `roles`, `validations`, `config`, `api-keys`.

When writing or deleting documents in Kuzzle, the changes need to be indexed before being reflected in the search results.
By default, this operation can take up to 1 second.

::: warn
Forcing immediate refreshes comes with performance costs, and should only performed when absolutely necessary.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_refreshInternal
Method: POST
```

### Other protocols

```js
{
  "collection": "<collection>",
  "controller": "collection",
  "action": "refreshInternal"
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
  "controller": "collection",
  "action": "refreshInternal",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/errors/handling#common-errors)
- [NotFoundError](/core/2/api/essentials/errors/handling#notfounderror)
