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

The collections have mappings that characterize the way Elasticsearch will index the data for the search.

::: info
It is recommended that you define your own mappings in order to specify the desired types for your collections and avoid default types that may be imprecise.
:::

If you're more familiar with the way relational databases store data, here is how it compares:

| Relational databases storage | Document-oriented storage |
| :--------------------------: | :-----------------------: |
| database                     | index                     |
| table                        | collection                |
| schema                       | mappings                  |
| line                         | document                  |
| column                       | field                     |

First, we are gonna create an index with Kourou: `kourou index:create nyc-open-data`

::: info
This will use the [index:create](/core/2/api/controllers/index/create) API action.
:::

Then, we are going to create a collection inside this index. We will provide the following basic mappings:

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

::: info
This will use the [collection:create](/core/2/api/controllers/index/create) API action.
:::


Now we have a collection ready to receive documents, again use Kourou to create one:

```bash
$ kourou document:create nyc-open-data yellow-taxi '{
  name: "Yagmur",
  age: 27
}'
```

::: info
This will use the [document:create](/core/2/api/controllers/index/create) API action.
:::

Finally, we are going to use the [Admin Console](http://console.kuzzle.io) to look at what we have created.

Select the `nyc-open-data` index and then the `yellow-taxi` collection. You should see one document in this collection.

![admin console show document](./admin-console-show-document.gif)
