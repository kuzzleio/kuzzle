# Kuzzle real-time engine

**Table of contents:**

  - [How it works](#how-it-works)
    - [Vocabulary](#vocabulary)
    - [Filter registration](#filter-registration)
    - [Storage and indexation](#storage-and-indexation)
    - [Matching](#matching)
    - [Deleting a filter](#deleting-a-filter)
  - [API](#api)
    - [`exists(index, collection)`](#existsindex-collection)
    - [`getFilterIds(index, collection)`](#getfilteridsindex-collection)
    - [`register(index, collection, filters)`](#registerindex-collection-filters)
    - [`remove(filterId)`](#removefilterid)
    - [`test(index, collection, data, [documentId])`](#testindex-collection-data-documentid)
    - [`validate(filters)`](#validatefilters)


## How it works

### Vocabulary
- a "filter" is the complete set of conditions contained in a subscription request. A "filter" is made of "subfilters", linked by OR operands: if 1 subfilter succeeds, the whole filter succeeds
- a "subfilter" is a subset of conditions linked with AND operands: if 1 condition fails, the whole subfilter fails
- a "condition" is an operand applied on a field, with one or multiple values (e.g. `{equals: { field: "value" } }` )
- a "field-operand" pair is an operand and its associated field (e.g. "field - equals")

### Filter registration

Upon registration, the provided filter is validated and partially rewritten in order to standardize the use of keywords. For instance, `bool` conditions are rewritten using AND/OR/NOT operands, "in" is converted to a succession of "equals" operands linked with OR operands, and so on.

Once a filter is validated, it is converted to its canonical form, a very close approximation of its [disjunctive normal form](https://en.wikipedia.org/wiki/Disjunctive_normal_form).
This allows separating a filter to a set of subfilters, themselves containing conditions.

Then comes the most important part of the new engine: the way filters are stored and indexed.

### Storage and indexation

The canonicalized filter is split and its parts are stored in different structures:
- `dsl.storage.filters` provides a link between a filter and its associated subfilters
- `dsl.storage.subfilters` provides a bidirectional link between a subfilter, its associated filters, and its associated conditions
- `dsl.storage.conditions` provides a link between a condition and its associated subfilters. It also contains the condition's value

Once the storage is done, an indexation is performed:
- `dsl.storage.foPairs` regroups all conditions associated to a field-operand pair. It means that, for instance, all "equals" condition on a field "field" are regrouped and stored together. The way these values are stored closely depends on the corresponding operand (for instance, "range" operands use a specific augmented AVL tree, while geospatial operands use a R\* tree)
- `dsl.storage.testTables` is the index allowing to efficiently track how many conditions a given subfilter has validated. This structure is the most important part of the matching mechanism (performance-wise) as it allows to very quickly check if a subfilter is completely matched and what filters should be returned for a given document.

### Matching

Whenever a document or a message is given to the engine to get the list of matching rooms, the subfilters indexes are duplicated, so that they can be updated without impacting the reference structure.

Then, for a given index/collection, all registered field-operand pairs are tested. For each subfilter reference matching a condition, the index is updated to decrement its number of conditions. If it reaches 0, its associated filter is added to the list of returned filters ID.
Another index is then updated, in order to ensure an unique list of returned IDs.

The way each field-operand pair performs its match depends closely on the keyword. Matching mechanisms are described in the corresponding `dsl/match/match*` files.

### Deleting a filter

When a filter gets deleted, the filters, subfilters, conditions and field-operand structures are cleaned up.
The indexes are left alone, unless more than 10% of the referenced subfilters have been deleted. If so, an index rebuild is triggered. This allow mutualizing the cost of rebuilding the indexes.

## API

### `exists(index, collection)`

Returns a boolean indicating if filters exist for an index-collection pair

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |


##### Returns

Returns `true` if at least one filter exists on the provided index-collection pair, returns `false` otherwise


### `getFilterIds(index, collection)`

Retrieves filter IDs registered on an index-collection pair


##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |

##### Returns

An `array` of `filterId` corresponding to filters registered on an index-collection pair.

### `register(index, collection, filters)`

Registers a filter to the DSL.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`filters`|`object`| Filters in [Kuzzle DSL](#filtering-syntax) format |

##### Returns

A `promise` resolving to an object containing the following attributes:

* `id`: the filter unique identifier
* `diff`: `false` if the filter already existed in the engine. Otherwise, contains an object with the canonical version of the provided filters

### `remove(filterId)`

Removes all references to a given filter from the DSL

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filterId`|`string`| Filter unique ID. Obtained by using `register`|

##### Returns

A `promise` resolved once the filter has been completely removed from the DSL

### `test(index, collection, data, [documentId])`

Test data against filters registered in the DSL, returning matching filter IDs, if any.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`index`|`string`| Data index name |
|`collection`|`string`| Data collection name |
|`data`|`object`| Data to test against filters |
|`documentId`|`string`| If applicable, document unique ID |


##### Returns

An array of `filterId` matching the provided data (and/or documentId, if any).

### `validate(filters)`

Tests the provided filters without storing them in the system, to check whether they are well-formed or not.

##### Arguments

| Name | Type | Description                      |
|------|------|----------------------------------|
|`filters`|`object`| Filters in [Kuzzle DSL](#filtering-syntax) format |

##### Returns

A resolved promise if the provided filters are valid, or a rejected one with the appropriate error object otherwise.
