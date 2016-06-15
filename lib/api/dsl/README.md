# Kuzzle DSL

## Table of Contents

- [Purpose](#purpose)
- [Directory files rundown](#directory-files-rundown)
- [Exposed DSL methods](#exposed-dsl-methods)
  - [`createFilterId(index, collection, filters)`](#createfilteridindex-collection-filters)
  - [`register(filterId, index, collection, filters)`](#registerfilterid-index-collection-filters)
  - [`remove(filterId)`](#removefilterid)
  - [`test(index, collection, data, [documentId])`](#testindex-collection-data-documentid)
  - [`exists(index, collection)`](#existsindex-collection)
  - [`getFilterIds(index, collection)`](#getfilteridsindex-collection)
- [Contributing](#contributing)

## Purpose

This module converts our API Domain Specific Language to internal filtering functions.  
It's used by Kuzzle for real-time subscriptions and notifications.

It is used by the `HotelClerk` core component, and plugins can instantiate their own DSL using the `Dsl` constructor available in the plugins context.  
Plugins DSL are independent instances and cannot interact with Kuzzle DSL.


Kuzzle's DSL syntax follows closely the [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html), and can be considered as a subset of Elasticsearch DSL.

## Directory files rundown

This folder contains the following files :

* **index.js**: entry point for the module, exposes DSL accessors
* **filters.js**: manages filters storage
* **methods.js**:  split and encode complex filters
* **operators.js**: implements filters operators
* **geoutil.js**: geolocation helper functions


## Exposed DSL methods

Instantiating a new DSL object gives access to the following methods:

### `createFilterId(index, collection, filters)`

Creates a filter unique ID using the provided arguments.

The calculation is predictable, meaning that the resulting filter ID will always be the same if invoked multiple times with the same arguments.

**Returns:**

A `string` containing the filter unique ID.

### `register(filterId, index, collection, filters)`

Registers a filter to the DSL.

The `filterId` argument can be handled by the caller, or it can be calculated using the `createFilterId` method.

**Returns:**

A `promise` resolving to the successfully added `filterId`.


### `remove(filterId)`

Removes all references to a given filter from the DSL

**Returns:**

A `promise` resolved once the filter has been completely removed from the DSL


### `test(index, collection, data, [documentId])`

Test data against filters in the filters tree, returning matching filter IDs, if any.

**Returns:**

A `promise` resolving to an array of `filterId` matching the provided data (and/or documentId, if any)

### `exists(index, collection)`

Returns a boolean indicating if filters exist for an index-collection pair

**Returns:**

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise

### `getFilterIds(index, collection)`

Retrieves filter IDs registered on an index-collection pair

**Returns:**

An `array` of `filterId` corresponding to filters registered on an index-collection pair.

## Contributing

You can refer to the [documentation](http://kuzzle.io/guide/#filtering-syntax) to get the list of the implemented filters.
