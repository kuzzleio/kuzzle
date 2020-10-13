---
code: false
type: page
title: Storing Data
description: Create and retrieve documents
order: 200
---

# Storing Data

Now that Kuzzle is running, we are going to create some documents.

Kuzzle organizes the data storage in 4 levels: 
  - indexes
  - collections
  - documents
  - fields

An index brings together several collections, which in turn contain several documents, each of which is composed of several fields.

Les collections ont des mappings qui caractérisent la manière dont Elasticsearch va indexer les données pour la recherche.

::: info
Il est recommandé de définir soi-même ses mappings afin de spécifier les types voulus pour ses collections.
:::

If you're more familiar with the way relational databases store data, here is how it compares:

| Document-oriented storage | Relational databases storage |
| --------------------- | -------------- | 
| index | database | 
| collection | table |
| document | line |
| field | column |

First, we are gonna create an index with Kourou: `kourou index:create nyc-open-data`

Then, we are gonna create a collection inside this index. We will provide the following basic mappings:

```js
{
  properties: {
    name: { type: "keyword" },
    age: { type: "integer" }
  }
}
```

Run the following command to create our `yellow-taxi` collection: 

```bash
$ kourou collection:create nyc-open-data yellow-taxi '{
  properties: {
    name: { type: "keyword" },
    age: { type: "integer" }
  }
}'
```