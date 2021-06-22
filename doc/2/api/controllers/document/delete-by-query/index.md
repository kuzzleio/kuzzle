---
code: true
type: page
title: deleteByQuery
---

# deleteByQuery

Deletes documents matching the provided search query.

Documents removed that way trigger real-time notifications.

<SinceBadge version="2.8.0"/>

This method also supports the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) to match documents by passing the `lang` argument with the value `koncorde`.  
Koncorde filters will be translated into an Elasticsearch query.  

::: warning
Koncorde `bool` operator and `regexp` clause are not supported for search queries.
:::

## Limitations

The request fails if the number of documents returned by the search query exceeds the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).

This behavior aims at limiting the pressure on memory and on real-time notifications.

To remove a greater number of documents, you can:
 - change the server configuration
 - split the search query
 - use a paginated [document:search](/core/2/api/controllers/document/search) with [document:mDelete](/core/2/api/controllers/document/m-delete)
 - use [bulk:deleteByQuery](/core/2/api/controllers/bulk/delete-by-query)

To remove all documents from a collection, use [collection:truncate](/core/2/api/controllers/collection/truncate) instead.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_query[?refresh=wait_for][&source][&lang=<query language>][&silent]
Method: DELETE
Body:
```

```js
{
  "query": {
    // ...
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "deleteByQuery",
  "refresh": "wait_for",
  "body": {
    "query": {
      // ...
    }
  }
}
```

### Kourou

```bash
kourou document:deleteByQuery <index> <collection> <body>
kourou document:deleteByQuery <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deleted documents are removed from the search indexes
- `source`: if set to `true` Kuzzle will return each deleted document body in the response.
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used. <SinceBadge version="2.8.0"/>
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />

---

## Body properties

- `query`: the search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) syntax.

---

## Response

Returns an object containing information about the deleted documents:

- `ids`: an array containing the list of each deleted document identifier <DeprecatedBadge version="2.2.1"/>.
- `documents` an array of the deleted documents. These contain their respective contents if the `source` is set to `true`.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "deleteByQuery",
  "requestId": "<unique request identifier>",
  "result": {
    "documents": [
     {
      "_id": "<deleted document unique identifier>",
      "_source": {
        // Document content, Present only if 'source' parameter is set to true.
      }
     }
    ],
    // Deprecated since 2.2.1, use the documents array instead.
    "ids": [
      "id 1",
      "id 2",
      "id ...",
      "id n"
    ]
  }
}
```
