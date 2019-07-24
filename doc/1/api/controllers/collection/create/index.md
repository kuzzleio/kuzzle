---
code: true
type: page
title: create
---

# create

Creates a new [collection](/core/1/guides/essentials/store-access-data), in the provided `index`.

<SinceBadge version="1.3.0" />

You can also provide an optional body with a [collection mapping](/core/1/guides/essentials/database-mappings) allowing you to exploit the full capabilities of our persistent data storage layer.

This method will only update the mapping when the collection already exists.

<SinceBadge version="1.7.1" />

You can define the collection [dynamic mapping policy](/core/1/guides/essentials/database-mappings/#dynamic-mapping-policy) by setting the `dynamic` field to the desired value.

You can define [collection additional metadata](/core/1/guides/essentials/database-mappings/#collection-metadata) within the `_meta` root field.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>
Method: PUT
Body:
```

```js
{
  "dynamic": "[false|true|strict]",
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
  "action": "create",
  "body": {
    "dynamic": "[false|true|strict]",
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

- `collection`: name of the collection to create
- `index`: index name

---

## Body properties

### Optional:

* `dynamic`: [dynamic mapping policy](/core/1/guides/essentials/database-mappings/#dynamic-mapping-policy) for new fields. Allowed values: `true` (default), `false`, `strict`
* `_meta`: [collection additional metadata](/core/1/guides/essentials/database-mappings/#collection-metadata) stored next to the collection
* `properties`: object describing the data mapping to associate to the new collection, using [Elasticsearch types definitions format](/core/1/guides/essentials/database-mappings/#properties-types-definition)

---

## Response

Returns a confirmation that the collection is being created:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "create",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true
  }
}
```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/#common-errors)
- [PreconditionError](/core/1/api/essentials/errors/#preconditionerror)
