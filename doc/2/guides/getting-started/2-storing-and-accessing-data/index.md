---
code: false
type: page
title: Storing and Accessing Data
description: Create and retrieve documents
order: 200
---

# Storing and Accessing Data

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

### Prepare the database

First, we are gonna create an index with Kourou: `kourou index:create nyc-open-data`

::: info
This will use the [index:create](/core/2/api/controllers/index/create) API action.
:::

Then, we are gonna create a collection inside this index. We will provide the following basic mappings:

```js
{
  properties: {
    name: { type: "keyword" },
    city: { type: "keyword" },
    age: { type: "integer" }
  }
}
```

Run the following command to create our `yellow-taxi` collection: 

```bash
$ kourou collection:create nyc-open-data yellow-taxi '{
  properties: {
    name: { type: "keyword" },
    city: { type: "keyword" },
    age: { type: "integer" }
  }
}'
```

::: info
This will use the [collection:create](/core/2/api/controllers/index/create) API action.
:::


### Create some documents

Now we have a collection ready to receive documents, again use Kourou to create one:

```bash
$ kourou document:create nyc-open-data yellow-taxi '{
  name: "Yagmur",
  city: "Antalya",
  age: 27
}'
```

::: info
This will use the [document:create](/core/2/api/controllers/index/create) API action.
:::

Finally, we are going to use the [Admin Console](http://console.kuzzle.io) to look at what we have created.

Select the `nyc-open-data` index and then the `yellow-taxi` collection. You should see one document in this collection.

![admin console show document](./admin-console-show-document.gif)

### Search for documents

One of the best strengths of Kuzzle is to expose directly and securely the search functionality of Elasticsearch.

We will be able to use the powerful query language of Elasticsearch to retrieve the documents we are interested in. 

First, we need to create more documents:

```bash
$ kourou sdk:execute --code '
  for (let i = 1; i <= 10; i++) {
    await sdk.document.create("nyc-open-data", "yellow-taxi", {
      name: `Yagmur-${i}`,
      city: i % 2 ? "Antalya" : "Istanbul",
      age: 27 + i
    });
  }'
```

::: info
Kourou is able to [execute](/core/2/api/kourou/commands/sdk/execute) Javascript code snippets.  
A `sdk` variable is exposed and refer to an instance of the [Javascript SDK](/sdk/js/7) connected (and authenticated if credentials were provided) to Kuzzle.
::: 

Then we are going to use the [document:search](/core/2/api/controllers/document/search) API action to fetch only documents where:
 - `age` is greather than `30`
 - `city` is equal to `Antalya`

For this, we need to write a [boolean query](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl-bool-query.html):

```js
{
  must: [
    {
      range: {
        age: { gt: 30 }
      }
    },
    {
      term: { city: "Antalya" }
    }
  ]
}
```

And to execute this query we are going to use Kourou again:

```bash
$ kourou document:search nyc-open-data yellow-taxi '{
  bool: {
    must: [
      {
        range: {
          age: { gt: 30 }
        }
      },
      {
        term: { city: "Antalya" }
      }
    ]
  }
}'
```

<details><summary>You should retrieve the following 3 documents:</summary>

```bash
 🚀 Kourou - Searches for documents
 
 [ℹ] Connecting to http://localhost:7512 ...
 [ℹ] Document ID: OYgZJnUBacNMjDl2504F
 Content: {
  "name": "Yagmur-5",
  "city": "Antalya",
  "age": 32,
  "_kuzzle_info": {
    "author": "-1",
    "createdAt": 1602662033156,
    "updatedAt": null,
    "updater": null
  }
}
 [ℹ] Document ID: O4gZJnUBacNMjDl2504n
 Content: {
  "name": "Yagmur-7",
  "city": "Antalya",
  "age": 34,
  "_kuzzle_info": {
    "author": "-1",
    "createdAt": 1602662033189,
    "updatedAt": null,
    "updater": null
  }
}
 [ℹ] Document ID: PYgZJnUBacNMjDl2505H
 Content: {
  "name": "Yagmur-9",
  "city": "Antalya",
  "age": 36,
  "_kuzzle_info": {
    "author": "-1",
    "createdAt": 1602662033222,
    "updatedAt": null,
    "updater": null
  }
}
 [✔] 3 documents fetched on a total of 3
```

</details>

Learn more about querying Elasticsearch: [Mappings and Search](/core/2/some-link-to-search-guide).