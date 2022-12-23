---
code: true
type: page
title: getProfileMapping | API | Core
---

# getProfileMapping



Gets the mapping of the internal security profiles collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/_mapping
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getProfileMapping"
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
  "action": "getProfileMapping",
  "requestId": "<unique request identifier>",
  "result": {
    "mapping": {
      // mapping
    }
  }
}
```
