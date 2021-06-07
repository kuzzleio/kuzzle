---
code: true
type: page
title: mappings
---

# mappings

<SinceBadge version="auto-version"/>

Gets the mapping of the internal users collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/_mappings
Method: GET
```

### Other protocols

```js
{
  "controller": "user",
  "action": "mappings"
}
```

---

## Response

Returns the internal profiles mapping, using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html).

```js
{
  "status": 200,
  "error": null,
  "controller": "user",
  "action": "mappings",
  "requestId": "<unique request identifier>",
  "result": {
    "mapping": {
      // ...
    }
  }
}
```
