---
code: true
type: page
title: scrollSpecifications
---

# scrollSpecifications



Moves a result set cursor forward, created by the [`searchSpecifications` request](/core/2/api/controllers/collection/search-specifications) when the `scroll` argument is provided.

Results returned by a `scroll` request reflect the state of the index at the time of the initial search request, like a fixed snapshot. Subsequent changes to documents do not affect the scroll results.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/validations/_scroll/<scrollId>[?scroll=<time to live>]
Method: GET
```

### Other protocols

```js
{
  "controller": "collections",
  "action": "scrollSpecifications",
  "scrollId": "<scrollId>",
  "scroll": "<time to live>"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name
- `scrollId`: cursor identifier, obtained with (/core/2/api/controllers/collection/search-specifications)

### Optional:

- `scroll`: reset the cursor TTL to the provided duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) format.

---

## Response

Returns an object containing the following properties:

- `hits`: an array of found documents. Each item is an object with the following properties:
  - `_id`: specification unique identifier
  - `_score`: search pertinence score
  - `_source`: validation specification
- `scrollId`: the cursor unique identifier for the next page of results. Scroll requests may return a new scroll identifier, so only the most recent one should be used
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
- [NotFoundError](/core/2/api/essentials/error-handling#notfounderror)

