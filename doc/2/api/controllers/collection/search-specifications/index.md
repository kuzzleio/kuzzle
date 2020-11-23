---
code: true
type: page
title: searchSpecifications
---

# searchSpecifications



Searches collection specifications.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/validations/_search[?from=0][&size=10][&scroll=<time to live>]
Method: POST
Body:
```

```js
{
  // A set of filters or queries matching documents you are looking for.
  "query": {
    ...
  }
}
```

### Other protocols

```js
{
  "controller": "collection",
  "action": "searchSpecifications",
  "body": {
    "query": {
      "Some": "filters"
    }
  },

  "from": 0,
  "size": 42,
  "scroll": "<time to live>"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `from` is usually used with the `size` argument, and defines the offset from the first result you want to fetch
- `scroll` is used to fetch large result sets, and it must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units). If set, a forward-only cursor will be created (and automatically destroyed at the end of the set duration), and its identifier will be returned in the `scrollId` property, along with the first page of the results. This cursor can then be moved forward using the [`scrollSpecifications` API action](/core/2/api/controllers/collection/scroll-specifications)
- `size` controls the maximum number of documents returned in the response

---

## Body properties

### Optional:

- `query`: a search query filtering the result, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html)

---

## Response

Returns an object containing the following properties:

- `hits`: an array of found documents. Each item is an object with the following properties:
  - `_id`: specification unique identifier
  - `_score`: search pertinence score
  - `_source`: validation specification
- `scrollId`: the cursor unique identifier for the next page of results. Present only if the `scroll` argument has been set
- `total`: the _total_ number of found specifications (usually greater than the number of items in the `hits` array)

Example:

```js
{
  "status": 200,
  "error": null,
  "action": "scrollSpecifications",
  "controller": "collection",
  "requestId": "<unique request identifier>",
  "result": {
    "scrollId": "<new scroll id>",
    "hits": [
      {
        "_id": "<specification unique ID>",
        "_score": 1,
        "_source": {
          "collection": "myCollection",
          "index": "myIndex",
          "validation": {
            "fields": {
              "fieldName": {
                "defaultValue": "a default value",
                "mandatory": true,
                "multivalued": {
                  "maxCount": 5,
                  "minCount": 1,
                  "value": true
                },
                "type": "string",
                "typeOptions": {
                  "length": {
                    "max": 12,
                    "min": 2
                  }
                }
              }
            },
            "strict": true
          }
        }
      }
    ],
    "total": 42
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)
