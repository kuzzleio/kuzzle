---
code: false
type: page
title: Store and Access Data
description: Create and retrieve documents
order: 200
---

# Store and Access Data

Now that Kuzzle is running, we are going to create some documents.

Kuzzle organizes the data storage in 4 levels: 
  - Indexes
  - Collections
  - Documents
  - Fields

An index brings together several collections, which in turn contain several documents, each of which is composed of several fields.

The **collections have mappings** that define the way Elasticsearch will index the data for searches.

::: info
By default Elasticsearch will try to infer the type of the fields introduced by documents.  
It is recommended that you define your own mappings in order to specify the desired types for your collections and avoid default types that may be imprecise.
Learn more about [mappings dynamic policy](/core/2/guides/main-concepts/data-storage#mappings-dynamic-policy)
:::

If you're more familiar with the way relational databases store data, here is an analogy. Bear in mind that this is only to give you a rough point of comparison with a relational database, the similarities end here:

| Relational databases storage | Document-oriented storage |
| :--------------------------: | :-----------------------: |
| database                     | index                     |
| table                        | collection                |
| schema                       | mappings                  |
| line                         | document                  |
| column                       | field                     |

::: info
Kuzzle uses Elasticsearch as a NoSQL document storage.  
Elasticsearch is primarily designed to be a search engine, so there are limitations when using it as a database.  
Learn more about those limitations in our in-depth guides: [Collection Mappings](/core/2/guides/main-concepts/data-storage#mappings-dynamic-policy) and [Querying Elasticsearch](/core/2/guides/main-concepts/querying)
::: 

### Prepare the database

First, we are going to create an index with Kourou: `kourou index:create nyc-open-data`

::: info
This will use the [index:create](/core/2/api/controllers/index/create) API action.
:::

Then, we are going to create a collection inside this index. We will provide the following basic mappings:

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
kourou collection:create nyc-open-data yellow-taxi '{
  mappings: {
    properties: {
      name: { type: "keyword" },
      city: { type: "keyword" },
      age: { type: "integer" }
    }
  }
}'
```

::: info
This will use the [collection:create](/core/2/api/controllers/collection/create) API action.
:::


### Create some documents

Now we have a collection ready to receive documents, again use Kourou to create one:

```bash
kourou document:create nyc-open-data yellow-taxi '{
  name: "Melis",
  city: "Istanbul",
  age: 25
}'
```

::: info
This will use the [document:create](/core/2/api/controllers/document/create) API action.
:::

Finally, we are going to use the [Admin Console](http://next-console.kuzzle.io) to look at what we have created.

Select the `nyc-open-data` index and then the `yellow-taxi` collection. You should see one document in this collection.

![admin console show document](./admin-console-show-document.gif)

### Search for documents

Kuzzle directly exposes [Elasticsearch's query language](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) in a secure way. 

We'll now use that to search for the documents we're interested in.

First, we need to create more documents:

```bash
kourou sdk:execute '
  for (let i = 1; i <= 10; i++) {
    await sdk.document.create("nyc-open-data", "yellow-taxi", {
      name: `Melis-${i}`,
      city: i % 2 ? "Antalya" : "Istanbul",
      age: 25 + i
    });
  }'
```

::: info
Kourou is able to [execute](https://github.com/kuzzleio/kourou/blob/master/README.md#kourou-sdkexecute-code) Javascript code snippets.  
A `sdk` variable is exposed and refers to an instance of the [Javascript SDK](/sdk/js/7), connected to Kuzzle and authenticated if credentials are provided.
::: 

Then we are going to use the [document:search](/core/2/api/controllers/document/search) API action to fetch only documents where:
 - `age` is greater than `30`
 - `city` is equal to `Antalya`

For this, we need to write a [Boolean Query](/core/2/guides/main-concepts/querying#boolean-query):

```js
{
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
}
```

And to execute this query we are going to use Kourou again:

```bash
kourou document:search nyc-open-data yellow-taxi '{
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

<details><summary>You should retrieve the following 2 documents:</summary>

```bash
 🚀 Kourou - Searches for documents
 
 [ℹ] Connecting to http://localhost:7512 ...
 [ℹ] Document ID: OYgZJnUBacNMjDl2504F
 Content: {
  "name": "Melis-7",
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
  "name": "Melis-9",
  "city": "Antalya",
  "age": 34,
  "_kuzzle_info": {
    "author": "-1",
    "createdAt": 1602662033189,
    "updatedAt": null,
    "updater": null
  }
}
[✔] 2 documents fetched on a total of 2
```

</details>

<GuidesLinks 
  :prev="{ text: 'Run Kuzzle', url: '/guides/getting-started/run-kuzzle' }" 
  :next="{ text: 'Set up Permissions', url: '/guides/getting-started/set-up-permissions' }" 
/>
