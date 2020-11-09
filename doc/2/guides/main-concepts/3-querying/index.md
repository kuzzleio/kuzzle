---
code: false
type: page
title: Querying
description: tbd
order: 300
---

# Querying

Kuzzle directly exposes [Elasticsearch's query language](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) in a secure way. 

It is possible for a client to send requests to **retrieve documents from any authorized collection**.

## Near Realtime

When documents are written in Elasticsearch, **they must then be indexed by the search engine in order to be available in the search results**.

This indexing is a background task managed by Elasticsearch that can take up to a second.

This means that when documents are written through Kuzzle API, **it can take up to a second before they are made available in the search results**. This operation is called the "refresh" of an indice.

::: info
This concerns only the results of the [document:search](/core/2/api/controllers/document/search) action.
The documents are always available via their unique identifiers and the [document:get](/core/2/api/controllers/document/get) and [document:mGet](/core/2/api/controllers/document/m-get) actions.
:::

However, there are mechanisms to control the availability of new documents.

### `refresh: 'wait_for'` option

Most of the actions of the document controller accept an additional option that is passed by Kuzzle to Elasticsearch: [refresh](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-refresh.html).

When the value of this option is `wait_for`, then Elasticsearch (and thus Kuzzle) will **return answer to the request only when the document has been indexed** to be available in the search.

**Example:** _Create document and wait for the collection to be refreshed_ 
```bash
kourou sdk:execute --code '
    await sdk.document.createOrReplace(
      "nyc-open-data",
      "yellow-taxi",
      "document-1",
      {
        age: 27,
        city: "Tirana" 
      },
      { refresh: "wait_for" });
  
  return sdk.document.search(
      "nyc-open-data",
      "yellow-taxi");
'
```


::: warning
This considerably lengthens the time needed for a request because Elasticsearch will wait a maximum of one second for the background indexing task to be performed.
:::

### Manual Refresh

It is possible to request a refresh of the documents of a collection with the [collection:refresh](/core/2/api/controllers/collection/refresh)action.

This action **can take up to a second** to refresh the underlying Elasticsearch indice.

**Example:** _Creates documents and then refresh the collection_ 
```bash
kourou sdk:execute --code '
  for (let i = 20; i--; ) {
    await sdk.document.createOrReplace(
      "nyc-open-data",
      "yellow-taxi",
      "document-" + i,
      {
        age: 27 + i,
        city: "Tirana" 
      });
  }

  await sdk.collection.refresh(
    "nyc-open-data",
    "yellow-taxi");
  
  return sdk.document.search(
      "nyc-open-data",
      "yellow-taxi");
'
```

## Basic Querying

Le [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) d'Elasticsearch est très complet et permet de faire des recherches très avancées dans ses données.

Elasticsearch brings clauses to look for a value in a particular field.

Clauses can be used directly or composed with a [Boolean Query](/core/2/guides/main-concepts/3-querying#boolean-query).

**Example:** _Simple top level clause: "city" field must be equal to "Antalya"_
```js
{
  term: { city: "Antalya" }
}
```

### Fake Data

Throughout this guide we will use this set of documents to perform search queries:

<details><summary>Create some documents</summary>

```bash
kourou collection:create ktm-open-data thamel-taxi '{
  mappings: {
    properties: {
      city: { type: "keyword" },
      name: { type: "keyword" },
      age: { type: "integer" },
      description: { type: "text" },
      position: { type: "geo_point" },
      drivers: {
        properties: {
          name: { type: "keyword" },
          age: { type: "integer" }
        }
      },
      cars: {
        type: "nested",
        properties: {
          name: { type: "keyword" },
          year: { type: "integer" }
        }
      }
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
        city: "Katmandu",
        name: "Liaa",
        age: 30,
        description: "Little Princes is great"
      }
    },
    { 
      _id: "doremi",
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

The [term](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-term-query.html) clause allows to returns documents that **contain an exact value** in a provided field.

Term clause should be used on fields with the [keyword](/core/2/guides/main-concepts/2-data-storage#mappings-properties) type.

::: info
You can use the term query to find documents based on a precise value such as a price, a product ID, or a username.
:::

**Example:** _Search for documents containing an exact field value_ 
```bash
kourou document:search ktm-open-data thamel-taxi '{
  term: { name: "Jenow" }
}'
```

### `match` clause

The [match](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-match-query.html) clause allows to returns documents that match a provided `text`, `number`, `date` or `boolean` field.

The match query is the standard query for **performing a full-text search**, including options for fuzzy matching.

**Example:** _Search for documents containing an approximate field value_ 
```bash
kourou document:search ktm-open-data thamel-taxi '{
  match: { description: "java" }
}'
```

### `range` clause

The [range](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-range-query.html) clause allows to returns documents that contain terms within a provided range.

It can be used with `number` and `date` fields but also with `keyword` even if it's less common.

The range is defined by it's boundary with `gt` (greather than), `lt` (lower than), `gte` (greather than or equal) and `lte` (lower than or equal).

**Example:** _Search for documents where the "age" field is between 30 and 42_ 
```bash
kourou document:search ktm-open-data thamel-taxi '{
  range: {
    age: {
      gte: 30,
      lte: 42
    }
  }
}'
```

### `ids` clause

The [ids](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-ids-query.html) clause allows to returns document based on their IDs (`_id` field).

**Example:** _Search for documents with their ids_ 
```bash
kourou document:search ktm-open-data thamel-taxi '{
  ids: {
    values: ["aschen", "liia"]
  }
}'
```

::: info
If you only have an `ids` clause in your search query then you should rather use the [document:mGet](/core/2/api/controllers/document/m-get) action.
:::

## Boolean Query

Il est possible de combiner plusieurs clauses dans une même requête en utilisant une [Boolean Query](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-bool-query.html).

The following 4 operands are available:
 - `must`: The clause must appear in matching documents and will contribute to the score.
 - `filter`: The clause must appear in matching documents. The score of the query will be ignored.
 - `should`: The clause should appear in the matching document.
 - `must_not`: The clause must not appear in the matching documents. The score of the query will be ignored.

**Example:** _Combining clauses to create an "AND" like search query_
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

**Example:** _Combining clauses to create an "OR" like search query_
```bash
kourou document:search ktm-open-data thamel-taxi '{
  bool: {
    should: [
      { term: { city: "Siccieu" } },
      { term: { city: "Katmandu" } },
    ]
  }
}'
```

## Sorting

Elasticsearch offre le possibilité de trier les résultats par un ou plusieurs field.

Sorting

## Pagination
Pagination: scroll vs size from
limits

## Aggregations
Lien vers aggregations + exemple
