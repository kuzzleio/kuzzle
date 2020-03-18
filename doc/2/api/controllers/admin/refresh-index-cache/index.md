---
type: page

code: true
title: refreshIndexCache
---

# refreshIndexCache

<SinceBadge version="2.2.0" />

Refresh the internal index cache with actual Elasticsearch indexes.  

::: info
This method is useful after importing a dump directly into Elasticsearch
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_refreshIndexCache
Method: POST
```

### Other protocols

```js
{
  "controller": "admin",
  "action": "refreshIndexCache"
}
```

---

## Response

Returns a 200 status when the index cache is successfully refreshed.
