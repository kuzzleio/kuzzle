---
code: true
type: page
title: export | API | Core
---

# export

<SinceBadge version="2.17.0"/>

Export searched documents.

This method behaves like a `document:search` except that it scrolls and formats the searched results in one of the supported format (`csv`, `jsonl`) then returns everything as an HTTP Stream,
that can either be downloaded directly from a browser or any scripts.

This method also supports the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) to match documents by passing the `lang` argument with the value `koncorde`.
Koncorde filters will be translated into an Elasticsearch query.

::: info
The `scroll` parameter represents the maximum time needed for the client to download a page of `size` results.
You should try with smaller pages of results if you experienced download problems.
:::

::: info
If you want to expose the exported documents in HTTP, you will need to create a `<a>` element and add a [single use token](/core/2/api/controllers/auth/create-token) in the link `jwt` argument.
:::

::: warning
Koncorde `bool` operator and `regexp` clause are not supported for search queries.
:::

::: warning
This method only supports the HTTP Protocol
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_export[?format=<export format>][&size=<int>][&scroll=<time to live>][&lang=<query language>]
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
  ],
  "fields": [
    // ["name", "age"]
  ],
  "fieldsName": {
    // "name": "Customer Name"
  }
}
```

You can also access this route with the `GET` verb:

```http
URL: http://kuzzle:7512/<index>/<collection>/_export[?format=<export format>][&size=<int>][&scroll=<time to live>][&lang=<query language>][&searchBody=<query, sort>][&fields=<fields to export>][&fieldsName=<header of each exported field>]
Method: GET
```

::: info
It's possible to pass arguments that are usually in the body into the query string in JSON format.
Following arguments are available: `query`, `fields` and `fieldsName`.
:::

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
    ],
    "fields": [
      // ["name", "age"]
    ]
  },

  // optional:
  "size": <page size>,
  "scroll": "<scroll duration>",
  "lang": "<query language>",
  "format": "<export format>",
  "fieldsName": {
    "name": "Customer Name"
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `separator`: This option is only supported for the `CSV` format, it defines which character sequence will be used to format the CSV documents
- `fields`: This option is only supported for the `CSV` format, it defines which fields should be exported
- `fieldsName`: This option is only supported for the `CSV` format, it defines how fields path should be renamed, if not present the field path will be used.
- `scroll`: This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed.
- `size`: set the maximum number of documents returned per result page. By default it's `10`.
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used.
- `format`: Set the format that should be used to export the documents. (`csv`, `jsonl`)

---

## Body properties

### Optional:

- `query`: the search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) syntax.
- `aggregations`: control how the search result should be [aggregated](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-aggregations.html)
- `sort`: contains a list of fields, used to [sort search results](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-request-sort.html), in order of importance
- `fields`: control which field should be exported, using lodash syntax.

An empty body matches all documents in the queried collection.

::: info
Only the following fields are available in the top level of the search body: `aggregations`, `aggs`, `collapse`, `explain`, `fields`, `from`, `highlight`, `query`, `search_timeout`, `size`, `sort`, `_name`, `_source`, `_source_excludes`, `_source_includes`
:::

---

## Response

Returns an HTTP Stream that contains the formatted documents
