---
code: false
type: page
title: Data Storage
description: Understand how works the underlaying document storage engine
order: 200
---

# Data Storage

Kuzzle uses Elasticsearch as a NoSQL document storage.

The data storage is organized in 4 levels: 
  - Indexes
  - Collections
  - Documents
  - Fields

An index brings together several collections, which in turn contain several documents, each of which is composed of several fields.

If you're more familiar with the way relational databases store data, here is an analogy. Bear in mind that this is only to give you a rough point of comparison with a relational database, the similarities end here:

| Relational databases storage | Document-oriented storage |
| :--------------------------: | :-----------------------: |
| database                     | index                     |
| table                        | collection                |
| schema                       | mappings                  |
| line                         | document                  |
| column                       | field                     |

Elasticsearch is **primarily designed to be a search engine**, so there are **limitations when using it as a database**:
 - once set, mappings types cannot be changed
 - no transaction system
 - [near realtime search](/core/2/guides/main-concepts/3-querying#some-anchor)

## Internal Representation

Elasticsearch does not have this notion of our two levels document-oriented storage.  

::: info
As the word `index` refers to Kuzzle indexes but also Elasticsearch indexes, we will rather use the term `indices` (also present in Elasticsearch documentation) for their indexes in order to avoid confusion.
:::

Kuzzle indexes and collections are emulated in Elasticsearch in the following way:
 - `indexes` **does not physically exist in Elasticsearch** but are only logical application containers. When an index is created, an empty indice is created in Elasticsearch to reserve the index name (e.g. `&nyc-open-data._kuzzle_keep`)
 - `collections` **correspond to Elasticsearch indexes** with all their properties (e.g. [mappings](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html), [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/index-modules.html#index-modules-settings), etc)

Kuzzle distinguish two types of storage: 
  - **private**: internal Kuzzle index, plugin private indexes
  - **public**: users indexes

Elasticsearch indices must comply to the following naming convention:
 - **private**: `%<kuzzle-index-name>.<kuzzle-collection-name>`
 - **public**: `&<kuzzle-index-name>.<kuzzle-collection-name>`

You can list Elasticsearch indices with this command:
```bash
kourou es:indices:cat
```

## Collection Mappings

With Elasticsearch, it is possible to **define mappings for collections**. These mappings refers to [Elasticsearch mappings](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html) and allow you to configure the way Elasticsearch will handle these collections.

There are 3 root fields for mapping configuration:
 - [properties](/core/2/guides/main-concepts/2-data-storage#mappings-properties): collection types definition
 - [dynamic](/core/2/guides/main-concepts/2-data-storage#mappings-dynamic-policy): dynamic mapping policy against new fields
 - [_meta](/core/2/guides/main-concepts/2-data-storage#mappings-metadata): collection metadata

The following API actions can be used to modify these mappings:
 - [collection:create](/core/2/api/controllers/collection/create)
 - [collection:update](/core/2/api/controllers/collection/update)
 - [admin:loadMappings](/core/2/api/controllers/admin/load-mappings)

### Mappings Properties
The field type definitions that will be inserted in a collection allow Elasticsearch to index your data for future searches.

Especially when searching on fields with special types such as `date` or `geo_shape`.

::: warning
Once a type has been defined for a field, it is not possible to modify it later.
:::

The main types are the following:
 - [keyword](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/keyword.html): used to store any string that represent structured content (e.g. `firstname`, `category`, etc)
 - [text](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/text.html): used to store texts and unstructured data (e.g. `description`, `email-body`, etc)
 - [integer, float, etc](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/number.html): used to store numbers
 - [date](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/date.html): used to store dates in different formats
 - [geo_point](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/geo-point.html): used to store lat/long coordinates

::: info
Nested fields can be declared by using the `properties` key instead of `type`. Then you can define nested fields inside this object.
:::

**Example:** _Declaring a collection mappings to correctly index a document_

The following mapping must be defined first:
```bash
kourou collection:create ktm-open-data thamel-taxi '{
  mappings: {
    properties: {
      category: { type: "keyword" },
      distance: { type: "integer" },
      position: { type: "geo_point" },
      driver: {
        properties: {
          name: { type: "keyword" }
        }
      }
    }
  }
}'
```

Then we can create a document which is going to be correctly indexed:
```bash
kourou document:create ktm-open-data thamel-taxi '{
  category: "limousine",
  distance: 120990,
  position: {
    lat: 27.730400,
    lon: 85.328467
  },
  driver: {
    name: "liia mery"
  }
}'
```

::: info
Refer to the Elasticsearch documentation for an exhaustive list of available types: [Elasticsearch mapping types](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-types.html)
:::

#### Arrays

With Elasticsearch, **every field can be an array**. 

To store an array of value, you can just send it as-is instead of a single value:
```bash
# Create a document with an array of category
kourou document:create ktm-open-data thamel-taxi '{
  category: ["limousine", "suv"],
}' --id document-1
```

If you want to **modify an existing array**, you need to **send it entirely**:
```bash
# Add the "4x4" value to the category array
kourou document:update ktm-open-data thamel-taxi '{
  category: ["limousine", "suv", "4x4"],
}'
```

::: info
If you need to frequently insert and remove values to an field then you should either use a nested object instead or use a [scripting language](https://www.elastic.co/guide/en/elasticsearch/reference/master/modules-scripting-painless.html) to modify the array.  
For security reason, Kuzzle only support the usage of scripts through the [Integrated Elasticsearch Client](/core/2/guides/main-concepts/2-data-storage#integrated-elasticsearch-client)
:::

Nested fields arrays can be represented in two differents ways:
 - [object](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/object.html): used to store JSON objects
 - [nested](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/nested.html): used to store array of structured JSON objects

The choice of a type rather than another one modifies the way Elasticsearch will index the field. If there is a **need to search inside your object array** then you should choose the `nested` type otherwise the default `object` type will be **less resource intensive**.

**Example:** _Create a collection with an `object` type and a `nested` type_
```bash
kourou collection:create ktm-open-data thamel-taxi '{
  mappings: {
    properties: {
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
```

### Mappings Dynamic Policy

For each collection, you can set the **policy against new fields that are not referenced** in the collection mapping by modifying the `dynamic` root field.

The value of this configuration will change the way Elasticsearch manages the creation of new fields that are not declared in the collection mapping.
  - `"true"`: stores the document and updates the collection mapping with the inferred type
  - `"false"`: stores the document and does not update the collection mapping (fields are not indexed)
  - `"strict"`: rejects the document

::: info
Kuzzle will accept either string or boolean values for the dynamic property but it's advised to always use string values.
:::

Refer to Elasticsearch documentation for more informations: [Elasticsearch dynamic mapping](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html)

The default policy for new collections is `"true"` and is configurable in the [kuzzlerc](/core/2/guides/essentials/configuration) file under the key `services.storageEngine.commonMapping.dynamic`.

::: warning
We advise not to let Elasticsearch dynamically infer the type of new fields in production.  
This can be a problem because then the mapping cannot be modified.
:::

It is also possible to specify a **different dynamic mapping policy for nested fields**. This can be useful in imposing a strict policy on the collection while allowing the introduction of new fields in a specific location.

**Example:** _Use a different policy for a nested field_
```bash
kourou collection:create ktm-open-data thamel-taxi '{
  mappings: {
    dynamic: "strict",
    properties: {
      category: { type: "keyword" },
      characteristics: {
        dynamic: "false",
        properties: {}
      }
    }
  }
}'
```

Then if you try to create a document with a field that is not referenced you will get an error:
```bash
kourou document:create ktm-open-data thamel-taxi '{
  category: "suv",
  ecologic: false
}'
```

But you can create a document with a non-referenced field inside the `characteristics` field:
```bash
kourou document:create ktm-open-data thamel-taxi '{
  category: "suv",
  characteristics: {
    argus: 4200
  }
}'
```

### Mappings Metadata

Elasticsearch allows the **definition of metadata that is stored next to the collections** in the root field `_meta`.
These metadata are ignored by Elasticsearch, they can contain any type of information specific to your application.

::: warning
Unlike the properties types definition, new collection metadata are not merged with the old one.

If you set the `_meta` field in your request, the old value will be overwritten.
:::

Refer to Elasticsearch documentation for more informations: [Elasticsearch mapping meta field](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-meta-field.html)

**Example:** _Create a collection with metadata_
```bash
kourou collection:create ktm-open-data thamel-taxi '{
  _meta: {
    postgresTable: "thamelTaxi"
  }
}'
```

These metadata can be retrieved with the [collection:getMapping](/core/2/api/controllers/collection/get-mapping) API action:
```bash
kourou collection:getMapping ktm-open-data thamel-taxi
```

### Load Mappings

It is possible to **load mappings from several collections** at once using the [admin:loadMappings](/core/2/api/controllers/admin/load-mappings) action.  

This action takes as parameter a definition of a set of indexes and collections with their associated mappings.  

The expected format is the following:
```js
{
  "<index>": {
    "<collection>": {
      "properties": {
        "<field>": {}
      }
    }
  },
  "<index>": {
    "<collection>": {
      "properties": {
        "<field>": {}
      }
    }
  }
}

```

::: info
It is recommended to **save the mappings of your application in a JSON file**.
:::

```bash
# Create a file containing the mappings
echo '
{
  "nyc-open-data": {
    "yellow-tax": {
      "properties": {
        "name": { "type": "keyword" },
        "age": { "type": "integer" }
      }
    }
  }
}
' > mappings.json

# Load it with Kourou
kourou admin:loadMappings < mappings.json
```

::: info
Kourou can read file content and put it the request body.
:::

<!-- 
  @todo load at startup with Kaaf
-->

## Collection Settings

In addition mappings, Elasticsearch exposes [settings](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/index-modules.html#index-modules-settings) that allow to finely configure the behavior of a collection.

Those settings allows to configure [custom analyzers](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/analysis-custom-analyzer.html) for example.


```bash
kourou collection:create ktm-open-data:yellow-taxi '{
  "settings": {
    "analysis": {
      "analyzer": {
        "my_custom_analyzer": {
          "type": "custom", 
          "tokenizer": "standard",
          "char_filter": [
            "html_strip"
          ],
          "filter": [
            "lowercase",
            "asciifolding"
          ]
        }
      }
    }
  }
}'
```

::: warning
While updating the collection settings, the collection will be [closed](https://www.elastic.co/guide/en/elasticsearch/reference/7.5/indices-close.html) until the new configuration has been applied.
:::


## Kuzzle Metadata

Whenever a **document is created, updated or deleted**, Kuzzle will **add or update the document's metadata**. Those metadata provides information about the document's lifecycle.

::: info
You can bypass metadata automatic creation by using [bulk:write](/core/2/api/controllers/bulk/write) or [bulk:mWrite](/core/2/api/controllers/bulk/m-write) actions.
:::

Metadata can be viewed in the document's `_kuzzle_info` field and contains the following properties:

- `author`: [unique identifier](/core/2/some-link) of the user who created the document.
- `createdAt`: timestamp of document creation (create or replace), in epoch-milliseconds format.
- `updatedAt`: timestamp of last document update in epoch-milliseconds format, or `null` if no update has been made.
- `updater`: [unique identifier](/core/2/some-link) of the user that updated the document, or `null` if the document has never been updated.

Here is an example of a Kuzzle response, containing a document's `_id` and `_source` fields:

```bash
kourou document:create ktm-open-data thamel-taxi '{
  driver: {
    name: "liia mery"
  }
}'

# Created document
{
  "_id": "bfKYl3UBKAwUi8z83JJG",
  "_source": {
    "driver": {
      "name": "liia mery"
    },
    "_kuzzle_info": {
      "author": "-1", # Anonymous user ID
      "createdAt": 1604566178884,
      "updatedAt": null,
      "updater": null
    }
  }
}
```

::: info
Metadata cannot be edited manually (except with [bulk:write](/core/2/api/controllers/bulk/write) or [bulk:mWrite](/core/2/api/controllers/bulk/m-write) actions). Kuzzle will discard any `_kuzzle_info` property sent in document content.  
::: 

### Metadata mappings

Kuzzle metadata default mappings is defined with default collection mappings under the key `services.storageEngine.commonMapping` of the [configuration](/core/2/guides/advanced/8-configuration) file.

```js
{
  "services": {
    // [...]
    "storageEngine": {
      // [...]
      "commonMapping": {
        "dynamic": "false",
        "properties": {
          "_kuzzle_info": {
            "properties": {
              "author":     { "type": "keyword" },
              "createdAt":  { "type": "date" },
              "updatedAt":  { "type": "date" },
              "updater":    { "type": "keyword" }
            }
          }
        }
      }
    }
  }
}
```

### Query on metadata

Kuzzle allows **search requests to access metadata directly**. This means that you'll have to search in the `_kuzzle_info` document property.

For example, to sort documents by creation date, we can use the following search query:

```bash
kourou document:search ktm-open-data thamel-taxi --sort '{
  "_kuzzle_info.createdAt": "asc" 
}'
```

## Write Documents

Kuzzle exposes many methods for writing documents. Most of them are actions of the [document](/core/2/api/controllers/document) controller.

### Write Single Document

Actions that allow writing a single document take the content of the document to be written in the request `body`.

Apart from the [document:create](/core/2/api/controllers/document/create) action, they also take the document `_id` as a parameter.

**Example:** _Create a document with the [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) action_

```bash
kourou document:createOrReplace ktm-open-data thamel-taxi '{
  driver: {
    name: "liia mery"
  }
}' --id liia
```

The [document:update](/core/2/api/controllers/document/update) action differs from other write actions because it takes a partial content with the field to update in the request `body`.

**Example:** _Partially update a document with the [document:createOrReplace](/core/2/api/controllers/document/create-or-replace) action_

```bash
kourou document:update ktm-open-data thamel-taxi '{
  category: "limousine"
}' --id liia
```

### Write Multiple Documents

If you need to **write multiple documents at once**, it is recommended to use one of the `m*` actions.  

::: info
If you need to create large volume of documents the fastest way possible then you should use the [bulk:import](/core/2/api/controllers/bulk/import) action.
:::

These actions work in the same way as single document actions (`createOrReplace` becomes `mCreateOrReplace`, `update` becomes `mUpdate`, etc) but by taking an array of documents in the `body` request.

**Example:** _Create multiple documents with the [document:mCreate](/core/2/api/controllers/document/m-create) action_

<!-- 
  @todo deprecate "body" and use "content" instead
-->

```bash
kourou document:mCreate ktm-open-data thamel-taxi '{
  documents: [
    {
      _id: "liia-mery",
      body: {
        driver: {
          name: "liia mery"
        },
        category: "limousine"
      }
    },
    {
      body: {
        driver: {
          name: "aschen"
        },
        category: "suv"
      }
    }
  ]
}'
```

### Write Limit

Kuzzle imposes a **limit to the number of documents that can be written by the same request**.

This limit ensures that Kuzzle and Elasticsearch are not overloaded by writing too many documents at once.

By default, this limit is `200` documents per request. It is possible to configure this value in the `limits.documentsWriteCount` key in the [configuration](/core/2/guides/advanced/8-configuration) file.

## Read Documents

Kuzzle exposes methods to read documents. There is two way of retrieving documents:
 - by document `_id`
 - with a [search query](/core/2/guides/main-concepts/3-querying)

### Retrieve Documents by _id

**Example:** _Retrieve a document by it's `_id` with [document:get](/core/2/api/controllers/document/get)_
```bash
kourou document:createOrReplace ktm-open-data thamel-taxi '{
  driver: {
    name: "liia mery"
  }
}' --id liia

kourou document:get ktm-open-data thamel-taxi --id liia
```

It's also possible to retrieve multiple documents at once with the [document:mGet]([document:get](/core/2/api/controllers/document/get)) action.

This methods takes an array of IDs in the request body.

**Example:** _Retrieve multiple documents_
```bash
kourou document:createOrReplace ktm-open-data thamel-taxi '{
  driver: {
    name: "aschen"
  }
}' --id aschen

kourou document:mGet ktm-open-data thamel-taxi '{
  ids: ["liia", "aschen"]
}'
```

### Search for Documents

Searches can be made to retrieve only the documents you want.

These searches are done by **writing Elasticsearch queries**.

You can consult the dedicated guide: [Querying](/core/2/guides/advanced/3-querying)

### Read Limit

Kuzzle imposes a **limit to the number of documents that can be returned by the same request**.

This limit ensures that Kuzzle and Elasticsearch are not overloaded by returning too many documents at once.

By default, this limit is `10000` documents per request. It is possible to configure this value in the `limits.documentsFetchCount` key in the [configuration](/core/2/guides/advanced/8-configuration) file.

## Bulk Actions

To perform lower level actions, it is possible to use the [bulk](/core/2/api/controllers/bulk) controller.

The actions of this controller may not follow some of the API principles such as:
 - adding [Kuzzle Metadata](/core/2/guides/main-concepts/2-data-storage#kuzzle-metadata)
 - triggering [Database Notifications](/core/2/guides/main-concepts/6-realtime-engine#database-notifications) 
 - application of [Data Validation](/core/2/guides/advanced/9-data-validation) rules
 - respect of [write limit](/core/2/guides/main-concepts/2-data-storage#some-anchor)

The following actions are available:
 - [bulk:write](/core/2/api/controllers/bulk/write): write a document
 - [bulk:mWrite](/core/2/api/controllers/bulk/m-write): write multiple documents
 - [bulk:import](/core/2/api/controllers/bulk/import): import documents as fast as possible
 - [bulk:deleteByQuery](/core/2/api/controllers/bulk/write): deletes large volume of documents matching a query

::: warning
Bulk actions are intended to be used by administrator and scripts.  
It is considered harmful to let end users execute those actions.
:::

## Integrated Elasticsearch Client

Kuzzle uses and exposes [Elasticsearch Javascript SDK](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html). 

It is possible to **interact directly with Elasticsearch** through clients exposed in the [Backend.storage](/core/2/some-link) property.

This property offers the possibility to **instantiate a new client** or to **use a lazy-instantiated client**. In both cases, the clients are configured to use the same Elasticsearch cluster as Kuzzle.

::: info
It is possible to overload the configuration used by default by instantiating a new Ealsticsearch client with the constructor [Backend.storage.Client](/core/2/some-link).
:::


**Example:** _Send a request directly to Elasticsearch_

```js
// Elasticsearch request to create a document
const esRequest =  {
  body: {
    name: 'Aschen',
    age: 27
  },
  // Internal name of the index "nyc-open-data" and the collection "yellow-taxi"
  index: '%nyc-open-data.yellow-taxi',
  op_type: 'create'
}

// Use directly an Elasticsearch client instance
await app.storage.client.index(esRequest)

// Instantiate and use a new client
const esClient = new app.storage.Client()
await esClient.index(esRequest)
```

::: warning
Kuzzle use an [internal naming system](/core/2/guides/main-concepts/2-data-storage#some-anchor) to map Elasticsearch index names with Kuzzle indexes and collections names.
:::
