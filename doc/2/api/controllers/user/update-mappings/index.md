---
code: true
type: page
title: updateMappings
---

# updateMappings

<SinceBadge version="auto-version"/>

Updates the internal user storage mapping.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/_mappings
Method: PUT
Body:
```

```js
{
  "properties": {
    // mapping
  }
}
```

### Other protocols

```js
{
  "controller": "user",
  "action": "updateMappings",

  "body": {
    "properties": {
      // mapping
    }
  }
}
```

---

## Body properties

- `properties`: mapping definition using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html)

---

## Response

Returns the updated mappings.

```js
{
  "status": 200,
  "error": null,
  "action": "updateMappings",
  "controller": "user",
  "requestId": "<unique request identifier>",
  "result": {
    // mappings
  },
}
```
