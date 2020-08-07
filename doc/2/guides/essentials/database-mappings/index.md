---
code: false
type: page
title: Define database mappings
order: 400
---

# Database mappings

With Elasticsearch, it is possible to define mappings for collections. These mappings allow you to configure the way Elasticsearch will handle these collections.

There are 3 root fields for mapping configuration:
 - [properties](/core/2/guides/essentials/database-mappings#properties-types-definition): collection types definition
 - [dynamic](/core/2/guides/essentials/database-mappings#dynamic-mapping-policy): dynamic mapping policy against new fields
 - [_meta](/core/2/guides/essentials/database-mappings#collection-metadata): collection metadata

The following API methods can be used to modify these mappings:
 - [collection:create](/core/2/api/controllers/collection/create)
 - [collection:updateMapping](/core/2/api/controllers/collection/update-mapping)

---

## Properties types definition

The field type definitions that will be inserted in a collection allow Elasticsearch to index your data for future searches.

Especially when searching on fields with special types such as `date` or `geo_shape`.

::: warning
Once a type has been defined for a field, it is not possible to modify it later.
:::

Refer to the Elasticsearch documentation for an exhaustive list of available types: [Elasticsearch mapping types](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-types.html)

### Example

If I want the following document to be correctly indexed:
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
```js
{
  "properties": {
    "category": { "type": "keyword" },
    "distance": { "type": "integer" },
    "position": { "type": "geo_point" },
    "driver": {
      "properties": {
        "name": { "type": "keyword" }
      }
    }
  }
}
```

This mapping is then passed in the body to the methods [collection:create](/core/2/api/controllers/collection/create) or [collection:updateMapping](/core/2/api/controllers/collection/update-mapping).

```bash
# First create a collection yellow-taxi in the nyc-open-index
curl -X PUT -d '{"properties":{"category":{"type":"keyword"},"distance":{"type":"integer"},"position":{"type":"geo_point"},"driver":{"properties":{"name":{"type":"keyword"}}}}}' -H "Content-Type: application/json" "http://localhost:7512/nyc-open-data/yellow-taxi?pretty"

# Then create the desired document
curl -X POST -d '{"category":"limousine","distance":120990,"position":{"lat":27.7304,"lon":85.328467},"driver":{"name":"liia meh ry"}}' -H "Content-Type: application/json" "http://localhost:7512/nyc-open-data/yellow-taxi/_create?pretty"
```

::: warning
Because of the way Elasticsearch manages collections, mappings are shared between indexes.

This means that if I have two collections in the same index and a field ```name``` with type ```keyword``` in the first collection, then I can't have a field ```name``` with a different type in the second collection.
:::

---

## Dynamic mapping policy

For each collection, you can set the policy against new fields that are not referenced in the collection mapping by modifying the `dynamic` root field.

The value of this configuration will change the way Elasticsearch manages the creation of new fields that are not declared in the collection mapping.
  - `"true"`: Stores the document and updates the collection mapping with the inferred type
  - `"false"`: Stores the document and does not update the collection mapping (fields are not indexed)
  - `"strict"`: Rejects the document

::: info
Kuzzle will accept either string or boolean values for the dynamic property but it's advised to always use string values.
:::

Refer to Elasticsearch documentation for more informations: [Elasticsearch dynamic mapping](https://www.elastic.co/guide/en/elasticsearch/guide/current/dynamic-mapping.html)

The default policy for new collections is `"true"` and is configurable in the [kuzzlerc](/core/2/guides/essentials/configuration) file under the key `services.storageEngine.commonMapping.dynamic`.

::: warning
We advise not to let Elasticsearch dynamically infer the type of new fields in production.

This can be a problem because then the mapping cannot be modified.
:::

It is also possible to specify a different dynamic mapping policy for nested fields. This can be useful in imposing a strict policy on the collection while allowing the introduction of new fields in a specific location.

### Example

If you want a `strict` dynamic policy for your entire collection, you have to define it in root level but you can have a different policy for nested types:

```js
{
  "dynamic": "strict"
  "properties": {
    "driver": {
      "dynamic": "false"
      "properties": // allow insertion of new fields in the driver nested field
    }
  }
}
```

```bash
# Define a strict dynamic policy for the yellow-taxi collection
curl -X PUT -d '{ "dynamic": "strict" }' -H "Content-Type: application/json"  "http://localhost:7512/nyc-open-data/yellow-taxi?pretty"

# Try to create a document with a field that is not referenced in the mapping
curl -X POST -d '{"language":"nepali"}' -H "Content-Type: application/json" "http://localhost:7512/nyc-open-data/yellow-taxi/_create?pretty"

# You should see an error with the following message:
# "mapping set to strict, dynamic introduction of [language] within [yellow-taxi] is not allowed"
```

---

## Collection metadata

Elasticsearch allows the definition of metadata that is stored next to the collections in the root field `_meta`.
These metadata are ignored by Elasticsearch, they can contain any type of information specific to your application.

::: warning
Unlike the properties types definition, new collection metadata are not merged with the old one.

If you set the ```_meta``` field in your request, the old value will be overwritten.
:::

Refer to Elasticsearch documentation for more informations: [Elasticsearch mapping meta field](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping-meta-field.html)

These metadata can be retrieved with the [collection:getMapping](/core/2/api/controllers/collection/get-mapping) API method.

### Example

```js
{
  "_meta": {
    "area": "Panipokhari"
  }
}
```

```bash
# Add collection metadata
curl -X PUT -d '{ "_meta": { "area": "Panipokhari" } }' -H "Content-Type: application/json"  "http://localhost:7512/nyc-open-data/yellow-taxi/_mapping?pretty"

# Retrieve it
curl -X GET -H "Content-Type: application/json"  "http://localhost:7512/nyc-open-data/yellow-taxi/_mapping?pretty"
```

---

## What Now?

* Learn to work with [Persistent Data](/core/2/guides/essentials/store-access-data)
* Read our [Elasticsearch Cookbook](/core/2/guides/cookbooks/elasticsearch) to learn more about how querying works in Kuzzle
* Use [document metadata](/core/2/guides/essentials/document-metadata) to find or recover documents
* Keep track of data changes using [Real-time Notifications](/core/2/guides/essentials/real-time)
