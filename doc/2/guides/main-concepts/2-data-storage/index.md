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

## Collection Mappings

With Elasticsearch, it is possible to **define mappings for collections**. These mappings allow you to configure the way Elasticsearch will handle these collections.

There are 3 root fields for mapping configuration:
 - [properties](/core/2/guides/main-concepts/2-data-storage#mappings-properties: collection types definition
 - [dynamic]((/core/2/guides/main-concepts/2-data-storage#mappings-dynamic-policy): dynamic mapping policy against new fields
 - [_meta]((/core/2/guides/main-concepts/2-data-storage#mappings-metadata): collection metadata

The following API methods can be used to modify these mappings:
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

**Example:** _Declaring a mapping to correctly store this document_
```js
{
  "category": "limousine",
  "distance": 120990,
  "position": {
    "lat": 27.730400,
    "lon": 85.328467
  },
  "driver": {
    "name": "liia mery"
  }
}
```

The following mapping must first be defined:
```bash
# Create the collection with the correct mappings
kourou collection:create ktm-open-data thamel-taxi '{
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
}'

# Create our document
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

#### Arrays

With Elasticsearch, every field can be an array. 

To store an array of value, you can just send it as-is instead of a single value:

```bash
# Create a document with an array of category
kourou document:create ktm-open-data thamel-taxi '{
  category: ["limousine", "SUV"],
}'
```

Nested objects can be represented in two differents ways:
 - [object](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/object.html): used to store JSON objects
 - [nested](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/nested.html): used to store array of JSON objects
::: info
Refer to the Elasticsearch documentation for an exhaustive list of available types: [Elasticsearch mapping types](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-types.html)
:::



Mappings: Property: types principaux, admin controller

### Mappings Metadata
Mappings: Meta

### Mappings Dynamic Policy
Mappings: Dynamic

### Load Mappings

admin

boot kuzzle

## Collection Settings
Settings (indices ES)

## Kuzzle Metadata
Kuzzle metadata: comment elles sont MAJ

## Write Documents
Write documents: single vs m*, update vs replace/create, limits

## Read Documents
Read documents: single vs m*, limits

## Bulk Actions
Bulk: no limits

## Direct Access to Elasticsearch

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


