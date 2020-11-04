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

::: info
Refer to the Elasticsearch documentation for an exhaustive list of available types: [Elasticsearch mapping types](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-types.html)
:::

#### Arrays

With Elasticsearch, every field can be an array. 

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


