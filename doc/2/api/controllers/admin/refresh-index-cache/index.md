---
code: true
type: page
title: refreshIndexCache | API | Core
---

# refreshIndexCache

<SinceBadge version="2.15.0"/>

Refreshes the index cache of the Kuzzle node that receives the request.

Each node keeps the list of the indexes and collections that exist in the storage engine. Use this action when that list is out of date, for instance after indexes or Elasticsearch aliases were created directly in Elasticsearch, without going through Kuzzle.

The node reads the indexes and collections from Elasticsearch and adds the missing ones to its cache, then reloads the collection write locks. If `services.storageEngine.generateMissingAliases` is enabled in the [configuration](/core/2/guides/advanced/configuration) (the default), the missing aliases are generated first.

::: info
Only the node that processes the request is refreshed, and only for the public storage (the indexes and collections created through the API).
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

Returns `null` once the cache is refreshed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "refreshIndexCache",
  "collection": null,
  "index": null,
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
