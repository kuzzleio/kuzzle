---
code: true
type: page
title: create
---

# create

<SinceBadge version="1.0.0"/>

Creates a new [collection](/core/2/guides/main-concepts/2-data-storage), in the provided `index`.

Collection names must meet the following criteria:

* Lowercase only
* Cannot include one of the following characters: `\\`, `/`, `*`, `?`, `"`, `<`, `>`, `|`, ` ` (space character), `,`, `#`, `:`, `%`, `&`, `.`
* Cannot be longer than 126 bytes (note it is bytes, so multi-byte characters will count towards the 126 limit faster)

You can also provide an optional body with a [collection mapping](/core/2/guides/main-concepts/2-data-storage#collection-mappings) allowing you to exploit the full capabilities of our persistent data storage layer.

This method will only update the mapping when the collection already exists.

You can define the collection [dynamic mapping policy](/core/2/guides/main-concepts/2-data-storage#mappings-dynamic-policy) by setting the `dynamic` field to the desired value.

You can define [collection additional metadata](/core/2/guides/main-concepts/2-data-storage#mappings-metadata) within the `_meta` root field.

<SinceBadge version="2.1.0"/>

You can also provide Elasticsearch index [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings) when creating a new collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>
Method: PUT
Body:
```

<SinceBadge version="2.1.0"/>

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

<DeprecatedBadge version="2.1.0"/>

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

<SinceBadge version="2.1.0"/>

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "create",
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

<DeprecatedBadge version="2.1.0"/>

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "create",
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

- `collection`: name of the collection to create
- `index`: index name

---

## Body properties

### Optional:

<SinceBadge version="2.1.0"/>

* `settings`: Elasticsearch index [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings)
* `mappings`: [collection mappings](/core/2/guides/essentials/database-mappings)

<DeprecatedBadge version="2.1.0"/>

* `dynamic`: [dynamic mapping policy](/core/2/guides/main-concepts/2-data-storage#mappings-dynamic-policy) for new fields. Allowed string values: `true` (default), `false`, `strict` or a boolean
* `_meta`: [collection additional metadata](/core/2/guides/main-concepts/2-data-storage#mappings-metadata) stored next to the collection
* `properties`: object describing the data mapping to associate to the new collection, using [Elasticsearch types definitions format](/core/2/guides/main-concepts/2-data-storage#mappings-properties)

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

- [Common errors](/core/2/api/errors/types#common-errors)
- [PreconditionError](/core/2/api/errors/types#preconditionerror)

