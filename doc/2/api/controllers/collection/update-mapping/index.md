---
code: true
type: page
title: updateMapping
---

# updateMapping

Updates a collection mapping.

<SinceBadge version="1.7.1" />

<DeprecatedBadge version="2.1.0" />

__Use [collection:update](/core/2/api/controllers/collection/update) instead.__

You can define the collection [dynamic mapping policy](/core/2/guides/essentials/database-mappings#dynamic-mapping-policy) by setting the `dynamic` field to the desired value.

You can define [collection additional metadata](/core/2/guides/essentials/database-mappings#collection-metadata) within the `_meta` root field.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mapping
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
    "field1": {
      "type": "integer"
    },
    "field2": {
      "type": "keyword"
    },
    "field3": {
      "type":   "date",
      "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"
    }
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "updateMapping",
  "body": {
    "dynamic": "[true|false|strict]",
    "_meta": {
      "field": "value"
    },
    "properties": {
      "field1": {
        "type": "integer"
      },
      "field2": {
        "type": "keyword"
      },
      "field3": {
        "type":   "date",
        "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"
      }
    }
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

* `dynamic`: [dynamic mapping policy](/core/2/guides/essentials/database-mappings#dynamic-mapping-policy) for new fields. Allowed values: `true` (default), `false`, `strict`
* `_meta`: [collection additional metadata](/core/2/guides/essentials/database-mappings#collection-metadata) stored next to the collection
* `properties`: object describing the data mapping to associate to the new collection, using [Elasticsearch types definitions format](/core/2/guides/essentials/database-mappings#properties-types-definition)

---

## Response

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "updateMapping",
  "controller": "collection",
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
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)
- [NotFoundError](/core/2/api/essentials/error-handling#notfounderror)

