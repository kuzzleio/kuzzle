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
  "dynamic": "[true|false|strict]",
  "_meta": {
    "field": "value"
  },
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
    "dynamic": "[true|false|strict]",
    "_meta": {
      "field": "value"
    },
    "properties": {
      // mapping
    }
  }
}
```

---

## Body properties

### Optional:

- `properties`: mapping definition using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html)
- `dynamic`: [dynamic mapping policy](/core/2/guides/main-concepts/data-storage#mappings-dynamic-policy) for new fields. Allowed values: `true` (default), `false`, `strict`
- `_meta`: [collection additional metadata](/core/2/guides/main-concepts/data-storage#mappings-metadata) stored next to the collection

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
    "dynamic": "false",
    "_meta": {
      "some": "metadata"
    },
    "properties": {
      "field1": {
        "type": "integer"
      }
    }
  },
}
```
