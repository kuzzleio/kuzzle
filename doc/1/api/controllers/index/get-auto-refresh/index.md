---
code: true
type: page
title: getAutoRefresh
---

# getAutoRefresh



Returns the current `autoRefresh` status for the given index.

The `autoRefresh` flag, when set to true, forces Kuzzle to perform a
[`refresh`](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/docs-refresh.html) request immediately after each change in the storage, causing documents to be immediately visible in a search.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/_autoRefresh
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "controller": "index",
  "action": "getAutoRefresh"
}
```

---

## Arguments

- `index`: index name

---

## Response

Returns a boolean giving the current value of the `autoRefresh` flag.

```js
{
  "status": 200,
  "error": null,
  "requestId": "<unique request identifier>",
  "index": "<index>",
  "controller": "index",
  "action": "getAutoRefresh",
  "result":  false
}
```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/handling#common-errors)
- [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror)
