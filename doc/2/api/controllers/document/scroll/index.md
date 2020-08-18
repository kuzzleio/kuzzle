---
code: true
type: page
title: scroll
---

# scroll

Moves a search cursor forward.

A search cursor is created by a [search](/core/2/api/controllers/document/search) API call, with a `scroll` value provided.

Results returned by a `scroll` request reflect the state of the index at the time of the initial search request, like a fixed snapshot. Subsequent changes to documents do not affect the scroll results.

::: info
The maximum value for a scroll session can be configured under the configuration key `services.storageEngine.maxScrollDuration`.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_scroll/<scrollId>[?scroll=<time to live>]
Method: GET
```

### Other protocols

```js
{
  "controller": "document",
  "action": "scroll",
  "scrollId": "<scrollId>",
  "scroll": "<time to live>"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name
- `scrollId`: cursor unique identifier, obtained by either a search or a scroll query

### Optional:

- `scroll`: refresh the cursor duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) syntax.

---

## Response

Returns a paginated search result set, with the following properties:

- `hits`: array of found documents. Each document has the following properties:
  - `_id`: document unique identifier
  - `_score`: [relevance score](https://www.elastic.co/guide/en/elasticsearch/guide/current/relevance-intro.html)
  - `_source`: new document content
- `remaining`: remaining documents that can be fetched <SinceBadge version="2.4.0"/>
- `scrollId`: identifier to the next page of result. Can be different than the previous one(s)
- `total`: total number of found documents. Usually greater than the number of documents in a result page

```js
{
  "status": 200,
  "error": null,
  "action": "scroll",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "scrollId": "<new scroll id>",
    "hits": [
      {
        "_id": "<document unique identifier>",
        "_score": 1,
        "_source": {
          // document content
        }
      },
      {
        "_id": "<another document unique identifier>",
        "_score": 1,
        "_source": {
          // document content
        }
      }
    ],
    "total": 42
  }
}
```
