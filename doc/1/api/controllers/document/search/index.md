---
code: true
type: page
title: search
---

# search



Searches documents.

There is a limit to how many documents can be returned by a single search query.
That limit is by default set at 10000 documents, and you can't get over it even with the `from` and `size` pagination options.

To handle larger result sets, you have to either create a cursor by providing a value to the `scroll` option or, if you sort the results, by using the Elasticsearch [search_after](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/search-request-search-after.html) command.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_search[?from=<int>][&size=<int>][&scroll=<time to live>][&includeTrash=<boolean>]
Method: POST
Body:
```

```js
{
  "query": {
    // ...
  },
  "aggregations": {
    // ...
  },
  "sort": [
    // ...
  ]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "search",
  "body": {
    "query": {
      // ...
    },
    "aggregations": {
      // ...
    },
    "sort": [
      // ...
    ]
  },

  // optional:
  "from": <starting offset>,
  "size": <page size>,
  "scroll": "<scroll duration>",
  "includeTrash": <boolean>
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `from`: paginates search results by defining the offset from the first result you want to fetch. Usually used with the `size` argument
- `includeTrash`: if true, include documents in the [trashcan](/core/1/guides/essentials/document-metadata/)
- `scroll`: creates a forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/common-options.html#time-units), at the end of which the cursor is destroyed. If set, a cursor identifier named `scrollId` is returned in the results. This cursor can then be moved forward using the [scroll](/core/1/api/controllers/document/scroll/) API action
- `size`: set the maximum number of documents returned per result page

---

## Body properties

### Optional:

- `query`: the search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/query-dsl.html) syntax.
- `aggregations`: control how the search result should be [aggregated](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/search-aggregations.html)
- `sort`: contains a list of fields, used to [sort search results](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/search-request-sort.html), in order of importance

An empty body matches all documents in the queried collection.

---

## Response

Returns a paginated search result set, with the following properties:

- `aggregations`: provides aggregation information. Present only if an `aggregations` object has been provided in the search body
- `hits`: array of found documents. Each document has the following properties:
  - `_id`: document unique identifier
  - `_score`: [relevance score](https://www.elastic.co/guide/en/elasticsearch/guide/current/relevance-intro.html)
  - `_source`: new document content
- `scrollId`: identifier to the next page of result. Present only if the `scroll` argument has been set
- `total`: total number of found documents. Can be greater than the number of documents in a result page, meaning that other matches than the one retrieved are available

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "search",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "scrollId": "<scroll id>",
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
    // Present only if aggregation parameters have been set
    "aggregations": {
      "aggs_name": {

      }
    },
    "total": 42
  }
}
```
