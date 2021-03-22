---
code: true
type: page
title: getUserMapping
---

# getUserMapping

<DeprecatedBadge version="auto-version">

Gets the mapping of the internal users collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/_mapping
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getUserMapping"
}
```

---

## Response

Returns the internal profiles mapping, using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html).

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "getUserMapping",
  "requestId": "<unique request identifier>",
  "result": {
    "mapping": {
      // ...
    }
  }
}
```
