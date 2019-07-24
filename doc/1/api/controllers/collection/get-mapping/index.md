---
code: true
type: page
title: getMapping
---

# getMapping

Returns a collection mapping.

<SinceBadge version="1.7.1" />

Also returns the collection [dynamic mapping policy](/core/1/guides/essentials/database-mappings/#dynamic-mapping-policy) and [collection additional metadata](/core/1/guides/essentials/database-mappings/#collection-metadata).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mapping
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "getMapping"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a mapping object with the following structure:

```
<index>
  |- mappings
    |- <collection>
      |- dynamic
      |- _meta
        |- metadata 1
        |- metadata 1
      |- properties
        |- mapping for field 1
        |- mapping for field 2
        |- ...
        |- mapping for field n
```

### Example:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "getMapping",
  "requestId": "<unique request identifier>",
  "result": {
    "<index>": {
      "mappings": {
        "<collection>": {
          "dynamic": "true",
          "_meta": {
            "metadata1": "value1"
          },
          "properties": {
            "field1": { "type": "integer" },
            "field2": { "type": "keyword" },
            "field3": {
              "type":   "date",
              "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"
            }
          }
        }
      }
    }
  }
}

```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/#common-errors)
- [NotFoundError](/core/1/api/essentials/errors/#notfounderror)
