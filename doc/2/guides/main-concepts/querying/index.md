---
code: false
type: page
title: Querying
description: Learn how to search for your data with Elasticsearch Query Language
order: 300
---

# Querying

Kuzzle directly exposes [Elasticsearch's query language](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) in a secure way.

It is possible for a client to send requests to **retrieve documents from any authorized collection**.

Search queries can be passed in the body of the [document:search](/core/2/api/controllers/document/search) action, which will be forwarded to Elasticsearch [Search API](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-search.html) endpoint.

Elasticsearch supports many keywords in a search query root level. For security reasons Kuzzle only supports the following keywords:
  - `aggregations`
  - `aggs`
  - `collapse`
  - `explain`
  - `from`
  - `highlight`
  - `query`
  - `search_after`
  - `search_timeout`
  - `size`
  - `sort`
  - `suggest`
  - `_name`
  - `_source`
  - `_source_excludes`
  - `_source_includes`

::: info
If any other keyword is present in a search query, Kuzzle will abort the request and return an error to the client.
:::

## Near Realtime

When documents are written in Elasticsearch, **they must then be indexed by the search engine in order to be available in search results**.

This indexing is a background task managed by Elasticsearch that can take up to a second.

This means that when documents are written through the Kuzzle API, **it can take up to a second before they are made available in the search results**. This operation is called the _refresh_ of a collection.

::: info
This concerns only the results of the [document:search](/core/2/api/controllers/document/search) action.
The documents are always available via their unique identifiers and the [document:get](/core/2/api/controllers/document/get) and [document:mGet](/core/2/api/controllers/document/m-get) actions.
:::

However, there are mechanisms to control the availability of new documents.

### Wait for Indexation

Most of the actions of the document controller accept an additional option that is passed by Kuzzle to Elasticsearch: [refresh](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-refresh.html).

When the value of this option is `wait_for`, then Elasticsearch (and thus Kuzzle) will **respond to the request only when the document has been indexed**.

**Example:** _Create a document and wait for the collection to be refreshed_
```bash
kourou sdk:execute '
  await sdk.document.createOrReplace(
    "ktm-open-data",
    "thamel-taxi",
    "document-1",
    {
      age: 27,
      city: "Tirana"
    },
    { refresh: "wait_for" });

  return sdk.document.search("ktm-open-data", "thamel-taxi");
'
```


::: warning
This **considerably lengthens the time needed for a request** because Elasticsearch will wait a maximum of one second for the background indexing task to be performed.
:::

### Manual Refresh

It is possible to request a manual refresh of the documents of a collection with the [collection:refresh](/core/2/api/controllers/collection/refresh) action.

This action **can take up to a second** to refresh the underlying Elasticsearch indice.

**Example:** _Create documents and then refresh the collection before searching it_
```bash
kourou sdk:execute '
  for (let i = 20; i--; ) {
    await sdk.document.createOrReplace(
      "ktm-open-data",
      "thamel-taxi",
      "document-" + i,
      {
        age: 27 + i,
        city: "Tirana"
      });
  }

  await sdk.collection.refresh("ktm-open-data", "thamel-taxi");

  return sdk.document.search("ktm-open-data", "thamel-taxi");
'
```

## Basic Querying

Elasticsearch's [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) allows to perform advanced searches in its data.

Elasticsearch brings **_clauses_ to look for a value in a particular field**.

Clauses can be used directly or composed with a [Boolean Query](/core/2/guides/main-concepts/querying#boolean-query).

**Example:** _Simple top level clause: "city" field must be equal to "Antalya"_
```js
{
  query: {
    term: { city: "Antalya" }
  }
}
```

### Fake Data

Throughout this guide we will use this set of documents to perform search queries:

<details><summary>Create a collection and some documents</summary>

```bash
kourou collection:create ktm-open-data thamel-taxi '{
  mappings: {
    properties: {
      city: { type: "keyword" },
      name: { type: "keyword" },
      age: { type: "integer" },
      description: { type: "text" }
    }
  }
}'

kourou document:mCreate ktm-open-data thamel-taxi '{
  documents: [
    {
      _id: "aschen",
      body: {
        city: "Tirana",
        name: "Aschen",
        age: 27,
        description: "Ruby is life"
      }
    },
    {
      _id: "jenow",
      body: {
        city: "Tirana",
        name: "Jenow",
        age: 32,
        description: "Java is my only love"
      }
    },
    {
      _id: "liia",
      body: {
        city: "Kathmandu",
        name: "Liaa",
        age: 30,
        description: "Little Princes is great"
      }
    },
    {
      _id: "domisol",
      body: {
        city: "Siccieu",
        name: "Dominique",
        age: 61,
        description: "I use to like PERL"
      }
    }
  ]
}'
```

</details>

### `term` clause

The [term](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-term-query.html) clause allows to return documents that **contain an exact value** in a provided field.

This clause should be used on fields with the [keyword](/core/2/guides/main-concepts/data-storage#mappings-properties) type.

::: info
You can use the `term` clause to find documents based on a precise value such as a price, a product ID, or a username.
:::

**Example:** _Search for documents containing an exact field value_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  term: { name: "Jenow" }
}' --lang elasticsearch
```

::: info
With Kourou the search query content will be injected in the request body inside the `query` property:
```js
{
  query: {
    term: { name: "Jenow" }
  }
}
```
:::

### `match` clause

The [match](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-match-query.html) clause allows to returns documents **that approximately match** a provided `text`, `number`, `date` or `boolean` field.

The match query is the standard query for **performing a full-text search**. As thus, it includes options for fuzzy matching.

::: info
The `match` clause as well as the content of a `text` fields are [analyzed](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/analysis-analyzers.html) by Elasticsearch before performing the query.
:::

**Example:** _Search for documents roughly matching the provided field value_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  match: { description: "java" }
}' --lang elasticsearch
```

### `range` clause

The [range](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-range-query.html) clause allows to return documents **that contain value within a provided range**.

It can be used with `number` or `date` fields (but not limited to).

Range boundaries are defined using `gt` (greather than), `lt` (lower than), `gte` (greather than or equal) and `lte` (lower than or equal).

**Example:** _Search for documents where the "age" field is between 30 and 42_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  range: {
    age: {
      gte: 30,
      lte: 42
    }
  }
}' --lang elasticsearch
```

### `ids` clause

The [ids](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-ids-query.html) clause allows to search documents **based on their IDs** (`_id` field).

**Example:** _Search for documents by id_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  ids: {
    values: ["aschen", "liia"]
  }
}' --lang elasticsearch
```

::: info
If you only have an `ids` clause in your search query then you should rather use the [document:mGet](/core/2/api/controllers/document/m-get) action.
:::

## Boolean Query

It is possible to **combine several clauses in the same query** by using a [Boolean Query](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-bool-query.html).

The following 4 operands are available:
 - `must`: Documents **must satisfy all the clauses** (logical `AND`), which will contribute to the score.
 - `filter`: Documents **must satisfy all the clauses** (logical `AND`), which will NOT contribute to the score.
 - `should`: Documents **must satisfy some of the clauses** (logical `OR`).
 - `must_not`: Documents **must NOT satisfy any the clauses** (logical `NOT`). The score of the query will be ignored.

**Example:** _Combining clauses to create an "AND"-like search query_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  bool: {
    filter: [
      { term: { city: "Tirana" } },
      { range: { age: { gte: 30 } } }
    ]
  }
}'
```

**Example:** _Combining clauses to create an "OR"-like search query_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  bool: {
    should: [
      { term: { city: "Siccieu" } },
      { term: { city: "Kathmandu" } },
    ]
  }
}' --lang elasticsearch
```

## Koncorde Query

<SinceBadge version="2.8.0"/>

It is also possible to use [Koncorde Filters Syntax](/core/2/api/koncorde-filters-syntax) to search documents.

To use a Koncorde filter instead of an Elasticsearch query, you have to pass the argument `lang` with the value `koncorde` to the API action.

::: info
These filters will be translated into Elasticsearch queries.
:::

All [clauses](/core/2/api/koncorde-filters-syntax/clauses) and [operators](/core/2/api/koncorde-filters-syntax/operators) are available the [bool](/core/2/api/koncorde-filters-syntax/operators#bool) operator.

**Example:** _Combining clauses to create an "AND"-like search query_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  and: [
    { equals: { city: "Tirana" } },
    { range: { age: { gte: 32 } } }
  ]
}'
```

<SinceBadge version="auto"/>

Also, native Elasticsearch clause can be used, they will just not be translated and added as-is in the search query.

**Example:** _Using Koncorde clause and native ES clause_

```bash
kourou document:search ktm-open-data thamel-taxi '{
  "and": [
    {
      "equals": {
        "city": "Istanbul"
      }
    },
    {
      "wildcard": {
        "name": {
          "value": "*e*"
        }
      }
    }
  ]
}'
```

## Sorting

Elasticsearch enables to **[sort the results](https://www.elastic.co/guide/en/elasticsearch/reference/current/sort-search-results.html) by one or more fields**.

**Example:** _Sort by multiple fields_
```bash
kourou document:search ktm-open-data thamel-taxi --sort '[
  { city: "asc" },
  { age: "desc" }
]'
```

A very common sort with Kuzzle is to use [Kuzzle Metadata](/core/2/guides/main-concepts/data-storage#kuzzle-metadata) to sort by creation date:

```bash
kourou document:search ktm-open-data thamel-taxi --sort '[
  { "_kuzzle_info.createdAt": "asc" }
]'
```

Finally, if you want to always ensure the same order for your results you can sort on the `_id` field:

```bash
kourou document:search ktm-open-data thamel-taxi --sort '[
  { "_id": "asc" }
]'
```

## Pagination

[Several pagination methods](https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html) are available using Elasticsearch and Kuzzle.

They allow to find all documents matching a search query.

::: info
By default, the [document:search](/core/2/api/controllers/document/search) action returns only 10 documents.
The number of returned documents can be changed with the `size` option.
Elasticsearch does not allow a `search` request to return more than 10000 documents, no matter what pagination parameters are set.
See the available [Pagination](/core/2/guides/main-concepts/querying#pagination) action methods to get more results.
:::

Those **methods are explained in the next sections and they are already implemented in our SDKs** in the `SearchResult` class. This class allows to navigate through your paginated results with ease by calling the `SearchResult.next` method (e.g. [SearchResult.next](/sdk/js/7/core-classes/search-result/next) method in the Javascript SDK).

**Example:** _Paginate search results using the scroll method_

:::: tabs

::: tab Javascript

Using the Javascript SDK [SearchResult.next](/sdk/js/7/core-classes/search-result/next) method:

```js
let result = await sdk.document.search('ktm-open-data', 'thamel-taxi', {
  query: {
    term: { city: 'Antalya' }
  }
},
{ scroll: '5s' });

while (result) {
  console.log(result.hits);
  result = await result.next();
}
```

:::
::: tab Dart

Using the Dart SDK [SearchResult.next](/sdk/dart/2/core-classes/search-result/next) method:

```dart
final result = await kuzzle
  .document
  .search('ktm-open-data', 'thamel-taxi', query: {
    'query': {
      'term': {
        'city': 'Antalya'
      }
    }
  },
  scroll: '5s');

while (result != null) {
  print(result.hits);
  result = await result.next();
}
```

:::

::: tab Kotlin

Using the Javascript SDK [SearchResult.next](/sdk/jvm/1/core-classes/search-result/next) method:

```kotlin
val term: ConcurrentHashMap<String, Any?> =
  ConcurrentHashMap<String, Any?>().apply {
    put("city", "Antalya")
  }
val query: ConcurrentHashMap<String, Any?> =
  ConcurrentHashMap<String, Any?>().apply {
    put("term", term)
  }
val searchQuery: ConcurrentHashMap<String, Any?> =
  ConcurrentHashMap<String, Any?>().apply {
    put("query", query)
  }

val results = kuzzle
  .documentController
  .search("ktm-open-data", "thamel-taxi", searchQuery, "1s").get();

while (result) {
  println(result.hits);

  result = result.next().get();
}
```

:::

::: tab Csharp

Using the Csharp SDK [SearchResults.NextAsync](/sdk/csharp/2/core-classes/search-results/next/) method:

```csharp
SearchOptions options = new SearchOptions {
  Scroll = "5s"
};

SearchResults result = await kuzzle.Document.SearchAsync(
    "ktm-open-data",
    "thamel-taxi",
    JObject.Parse(@"{
      query: {
        term: {
          city: 'Antalya'
        }
      }
    }"),
    options);

while (result != null) {
  Console.Out.WriteLine(result.hits);
  result = await result.NextAsync();
}

:::

::::

### Paginate with `from` and `size`

Pagination can be done by incrementing the `from` parameter value to retrieve further results.

It's the fastest pagination method available, but also the less consistent.

::: info
Because this method does not freeze the search results between two calls, there can be missing or duplicated documents between two result pages.
Also it's not possible to retrieve more than 10000 documents with this method.
:::

**Example:** _Use sort and size to navigate through pages of results_

```bash
kourou document:search ktm-open-data thamel-taxi --from 0 --size 2

kourou document:search ktm-open-data thamel-taxi --from 2 --size 2
```

### Paginate with `search_after`

Pagination can be done by using the [search_after](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-request-body.html#request-body-search-search-after) parameter.

This method allows to navigate through result pages by providing values that identify the next documents.

::: warning
You have to provide a sort combination that will **always identify one item only**. The recommended way is to use the field `_id` which is certain to contain one unique value for each document.
:::

**Example:** _Use sort and size to navigate through pages of results_

```bash
kourou sdk:query document:search \
  -i ktm-open-data -c thamel-taxi -a size=2 --body '{
    sort: [
      { _id: "desc" }
    ],
  }'

# {
#   "hits": [
#     {
#       "_id": "liaa",
#         # ...
#       }
#     },
#     {
#       "_id": "jenow",
#         # ...
#       }
#     }
#   ],
#   "total": 4
# }
```

Then we will include the `_id` of the last document in the `search_after` parameter:
```bash
kourou sdk:query document:search \
  -i ktm-open-data -c thamel-taxi -a size=2 --body '{
    sort: [
      { _id: "desc" }
    ],
    search_after: ["jenow"]
  }'

# {
#   "hits": [
#     {
#       "_id": "domisol",
#         # ...
#       }
#     },
#     {
#       "_id": "aschen",
#         # ...
#       }
#     }
#   ],
#   "total": 4
# }
```

::: info
Because this method does not freeze the search results between two calls, **there can be missing or duplicated documents between two result pages**.
This method efficiently mitigates the costs of scroll searches, but returns less consistent results: it's a middle ground, **ideal for real-time search requests**.
:::

### Paginate with Scroll Cursor

The `scroll` parameter can be specified in the search query to allow the usage of the [document:scroll](/core/2/api/controllers/document/scroll) action. This option creates **a forward-only cursor** to move through paginated results.

The **results from a scroll request are frozen**, and reflect the state of the collection at the time the initial search request.
For that reason, this action is **guaranteed to return consistent results**, even if documents are updated or deleted in the database between two pages retrieval.

This is the **most consistent way to paginate results**, however, this comes at a **higher computing cost** for the server.

To use this pagination method, you need to pass a `scroll` parameter with a duration. This duration corresponds to the **time during which Elasticsearch will keep your results frozen**. This duration will be refreshed at each call of the [document:scroll](/core/2/api/controllers/document/scroll) action.

::: info
The value of the `scroll` option should be the time needed to process one page of results.
This value has a maximum value which can be modified under the `services.storage.maxScrollDuration` [configuration](/core/2/guides/advanced/configuration) key.
:::

The search action will return a `scrollId` that you have to use with the [document:scroll](/core/2/api/controllers/document/scroll) to get the next page of results.

**Example:** _Paginate search with scroll_
```bash
kourou sdk:query document:search \
  -i ktm-open-data -c thamel-taxi -a scroll=1s -a size=2

# {
#   "hits": [
#     {
#       "_id": "aschen",
#         # ...
#       }
#     },
#     {
#       "_id": "jenow",
#         # ...
#       }
#     }
#   ],
#   "remaining": 2,
#   "scrollId": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAAACUWblZVaDV4UnNTck9mLU9wczZUVlBkUQ==",
#   "total": 4
# }
```

Then we have to pass the `scrollId` parameter to the [document:scroll](/core/2/api/controllers/document/scroll) action:
```bash
kourou sdk:query document:scroll -a scrollId=<scroll-id>

# {
#   "hits": [
#     {
#       "_id": "liia",
#         # ...
#       }
#     },
#     {
#       "_id": "domisol",
#         # ...
#       }
#     }
#   ],
#   "remaining": 0,
#   "scrollId": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAAACUWblZVaDV4UnNTck9mLU9wczZUVlBkUQ==",
#   "total": 4
# }
```

::: warning
When using a cursor with the `scroll` option, Elasticsearch has to duplicate the transaction log to keep consistent results during the entire scroll session.
It **can lead to memory issues** if a scroll duration too high is provided, or if too many scroll sessions are open simultaneously.


By default, Kuzzle sets a maximum scroll duration of 1 minute.
This can be changed in the kuzzlerc configuration file under the key `services.storageEngine.maxScrollDuration`.
:::

::: info
Kuzzle automatically destroys scroll cursors that have been consumed. Invoking the `document:scroll` action on a scroll ID whose results have been completely fetched will lead to an "unknown scroll ID" error.
:::
## Aggregations

Elasticsearch allows data to be **grouped together** to **build complex summaries** of the data through a mechanism called aggregations.

This mechanism allows to **structure the data returned in the response** in order to easily build dashboards, graphs, maps, etc.

More information on [Elasticsearch Aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-aggregations.html)
