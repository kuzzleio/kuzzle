---
code: true
type: page
title: update
---

# update

Updates a collection configuration.

<SinceBadge version="2.1.0" />

You can update the collection [mappings](/core/2/guides/main-concepts/data-storage#collection-mappings) and [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings).

::: warning
While updating the collection [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings), the collection will be [closed](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/indices-close.html) until the new configuration has been applied.
:::

::: info
The search index is automatically refreshed, so you can perform a `document:search` on [new properties](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-update-by-query.html#picking-up-a-new-property) right after.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>
Method: POST
Body:
```

```js
{
  "mappings": {
    "dynamic": "[true|false|strict]", // boolean are also accepted
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
  },
  "settings": {
    "analysis" : {
      "analyzer":{
        "content":{
          "type":"custom",
          "tokenizer":"whitespace"
        }
      }
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
  "action": "update",
  "body": {
    "mappings": {
      "dynamic": "[true|false|strict]", // boolean are also accepted
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
    },
    "settings": {
      "analysis" : {
        "analyzer":{
          "content":{
            "type":"custom",
            "tokenizer":"whitespace"
          }
        }
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

* `settings`: Elasticsearch index [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings)
* `mappings`: [collection mappings](/core/2/guides/main-concepts/data-storage#mappings-properties)

---

## Response

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "update",
  "controller": "collection",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

