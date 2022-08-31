---
code: true
type: page
title: "0x01: services"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x01: services



### Subdomain: 0x0101: storage

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| services.storage.unknown_index<br/><pre>0x01010001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The index "%s" does not exist. | The provided data index does not exist |
| services.storage.unknown_collection<br/><pre>0x01010002</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The collection "%s":"%s" does not exist. | The provided data collection does not exist |
| services.storage.get_limit_exceeded<br/><pre>0x01010003</pre>  | [SizeLimitError](/core/2/api/errors/error-codes#sizelimiterror) <pre>(413)</pre> | The number of documents returned by this request exceeds the configured server limit. | The number of documents returned by this request exceeds the configured server limit |
| services.storage.write_limit_exceeded<br/><pre>0x01010004</pre>  | [SizeLimitError](/core/2/api/errors/error-codes#sizelimiterror) <pre>(413)</pre> | The number of documents edited by this request exceeds the configured server limit. | The number of documents edited by this request exceeds the configured server limit |
| services.storage.import_failed<br/><pre>0x01010005</pre>  | [PartialError](/core/2/api/errors/error-codes#partialerror) <pre>(206)</pre> | Failed to import some or all documents. | Failed to import some or all documents |
| services.storage.no_multi_indexes<br/><pre>0x01010006</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple indexes. | Cannot be run on multiple indexes |
| services.storage.no_multi_collections<br/><pre>0x01010007</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple collections. | Cannot be run on multiple collections |
| services.storage.incomplete_delete<br/><pre>0x01010009</pre>  | [PartialError](/core/2/api/errors/error-codes#partialerror) <pre>(206)</pre> | Couldn't delete all the requested documents: %s | Couldn't delete all the requested documents |
| services.storage.not_found<br/><pre>0x0101000b</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Document "%s" not found in "%s":"%s". | Document not found |
| services.storage.bootstrap_timeout<br/><pre>0x0101000c</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | %s: bootstrap failed - lock wait timeout exceeded. | Bootstrap of a storage instance failed because it has been locked for too much time |
| services.storage.version_mismatch<br/><pre>0x0101000d</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Your elasticsearch version is %s: this version is not compatible with this version of Kuzzle | The version of the target Elasticsearch is not compatible with this version of Kuzzle |
| services.storage.unknown_scroll_id<br/><pre>0x0101000e</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Non-existing or expired scroll identifier. | The scroll identifier does not exist or has expired |
| services.storage.search_as_an_id<br/><pre>0x0101000f</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | _search is not a valid document identifier | Used "_search" as a document identifier, which conflicts with the _search HTTP route |
| services.storage.unknown_index_collection<br/><pre>0x01010010</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The provided index and/or collection doesn't exist. | The provided index and/or collection doesn't exist |
| services.storage.document_already_exists<br/><pre>0x01010011</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Document already exists. | A document with the same identifier already exists |
| services.storage.missing_argument<br/><pre>0x01010012</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Required argument "%s" is missing or is empty | A required argument is missing or is empty |
| services.storage.invalid_argument<br/><pre>0x01010013</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Argument "%s" is invalid (expected: %s) | Invalid argument provided |
| services.storage.index_protected<br/><pre>0x01010014</pre> <DeprecatedBadge version="2.5.0"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Index '%s' is protected, use the appropriated routes instead. | The content of a protected index cannot be modified with generic API routes |
| services.storage.invalid_mapping<br/><pre>0x01010015</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid mapping property "mappings.%s".%s | The provided mapping is invalid |
| services.storage.collection_reserved<br/><pre>0x01010016</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid collection name. "%s" is reserved for internal usage. | Collections cannot be named "_kuzzle_keep" because it is reserved for internal use. |
| services.storage.no_routing<br/><pre>0x01010017</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The "_routing" keyword is forbidden. | The "_routing" keyword is forbidden |
| services.storage.not_connected<br/><pre>0x01010018</pre>  | [ExternalServiceError](/core/2/api/errors/error-codes#externalserviceerror) <pre>(500)</pre> | Elasticsearch service is not connected. | Unable to connect to the storage instance |
| services.storage.too_many_operations<br/><pre>0x01010019</pre>  | [ExternalServiceError](/core/2/api/errors/error-codes#externalserviceerror) <pre>(500)</pre> | "%s" threads buffer exceeded. Too many operations received at once. | Too many operations received |
| services.storage.cannot_change_mapping<br/><pre>0x0101001a</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Field "%s" already has a mapping, and it cannot be changed | Cannot change the mapping of a field (once set, a field mapping cannot be changed) |
| services.storage.duplicate_field_mapping<br/><pre>0x0101001b</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot set mapping for field "%s" on collection "%s" because this field name is already used in another collection, with a different type. | A same field cannot have different mappings within the same index (fields are shared to all of an index collections) |
| services.storage.unexpected_properties<br/><pre>0x0101001c</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Property "%s" is not supported for field "%s". | Unexpected properties found |
| services.storage.invalid_mapping_type<br/><pre>0x0101001d</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Field "%s": the data type "%s" doesn't exist | Unrecognized mapping data type |
| services.storage.wrong_mapping_property<br/><pre>0x0101001e</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot parse mapping property "%s" | A mapping property cannot be parsed |
| services.storage.invalid_mapping_argument<br/><pre>0x0101001f</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Field "%s": invalid mapping property "%s". | Invalid mapping property |
| services.storage.too_many_changes<br/><pre>0x01010020</pre>  | [ExternalServiceError](/core/2/api/errors/error-codes#externalserviceerror) <pre>(500)</pre> | Unable to modify document "%s": cluster sync failed (too many simultaneous changes applied) | Too many changes occured on the same resource in a small amount of time. Try with the "retryOnConflict" option |
| services.storage.unexpected_bad_request<br/><pre>0x01010021</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | %s | Embeds an unexpected bad request error from Elasticsearch |
| services.storage.unexpected_not_found<br/><pre>0x01010022</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | %s | Embeds an unexpected notfound error from Elasticsearch |
| services.storage.unexpected_error<br/><pre>0x01010023</pre>  | [ExternalServiceError](/core/2/api/errors/error-codes#externalserviceerror) <pre>(500)</pre> | %s | Embeds an unexpected error from Elasticsearch |
| services.storage.no_mapping_found<br/><pre>0x01010025</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | No mapping found for index "%s". | Attempted to read a non-existent mapping |
| services.storage.index_already_exists<br/><pre>0x01010026</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | A %s index named "%s" already exists | Attempted to create an already existing index |
| services.storage.forbidden_character<br/><pre>0x01010027</pre> <DeprecatedBadge version="2.0.1"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | An index or a collection name cannot contain the character "%s" | An index or a collection name contains a forbidden character |
| services.storage.invalid_search_query<br/><pre>0x01010028</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The argument "%s" is not allowed at this level of a search query. | A forbidden argument has been provided in the search query |
| services.storage.invalid_index_name<br/><pre>0x01010029</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The index name "%s" is invalid | A provided index name is invalid |
| services.storage.invalid_collection_name<br/><pre>0x0101002a</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The collection name "%s" is invalid | A provided collection name is invalid |
| services.storage.strict_mapping_rejection<br/><pre>0x0101002b</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot create document. Field "%s" is not present in collection "%s:%s" strict mapping | Document rejected because it contains a field that is not declared in the strict mapping. |
| services.storage.scroll_duration_too_great<br/><pre>0x0101002c</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Scroll duration "%s" is too great. | The scroll duration exceed the configured maxium value. (See config.services.storageEngine.maxScrollDuration) |
| services.storage.unknown_query_keyword<br/><pre>0x0101002d</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The keyword "%s" is not part of Elasticsearch Query DSL. Are you trying to use a Koncorde query? | An unknown keyword has been provided in the search query |
| services.storage.incomplete_update<br/><pre>0x0101002e</pre>  | [MultipleErrorsError](/core/2/api/errors/error-codes#multipleerrorserror) <pre>(400)</pre> | %s documents were successfully updated before an error occured | Couldn't update all the requested documents |
| services.storage.invalid_query_keyword<br/><pre>0x0101002f</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The "%s" keyword is not allowed in this query. | A forbidden keyword has been provided in the query |
| services.storage.multiple_indice_alias<br/><pre>0x01010030</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | An %s is not allowed to be associated with multiple %s. This is probably not linked to this request but rather the consequence of previous actions on ElasticSearch. | The unique association between an indice and its alias has not been respected |
| services.storage.invalid_multi_index_collection_usage<br/><pre>0x01010031</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Searches on multiple collections should be achieved with the "targets" argument who contains list of indexes and collections to search within. | Searches on multiple collections should be achieved with the "targets" argument who contains list of indexes and collections to search within. |
| services.storage.invalid_target_format<br/><pre>0x01010032</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The %s ("%s") contains invalid characters ",+*" or is equal to "_all" which is forbidden | When a target index or collections contains invalid characters used for multi index search or "_all" |
| services.storage.wrong_es_static_settings_for_collection_recreation<br/><pre>0x01010033</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Attempt to recreate an existing collection %s of index %s of scope %s with non matching static setting : %s at %s while existing one is at %s | The ES static settings specified at the creation of an existing collection does not match existing settings |
| services.storage.delete_virtual_collection<br/><pre>0x01010034</pre>  | [ForbiddenError](/core/2/api/errors/error-codes#forbiddenerror) <pre>(403)</pre> | You can't remove a virtual collection.  | Remove virtual collection is forbidden |
| services.storage.create_virtual_collection<br/><pre>0x01010035</pre>  | [ForbiddenError](/core/2/api/errors/error-codes#forbiddenerror) <pre>(403)</pre> | you have not rights to create collection in a virtual index | create collection in a virtual index is forbidden |
| services.storage.update_virtual_collection<br/><pre>0x01010036</pre>  | [ForbiddenError](/core/2/api/errors/error-codes#forbiddenerror) <pre>(403)</pre> | you have not rights to update collection in a virtual index | update collection in a virtual index is forbidden |
| services.storage.update_virtual_index<br/><pre>0x01010037</pre>  | [ForbiddenError](/core/2/api/errors/error-codes#forbiddenerror) <pre>(403)</pre> | you have not rights to update settings in a virtual index | update settings in a virtual index is forbidden |

---


### Subdomain: 0x0103: cache

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| services.cache.database_not_found<br/><pre>0x01030001</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Cache database "%s" not found. | Unknown cache database name |
| services.cache.read_failed<br/><pre>0x01030002</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cache read fail: %s | An attempt to read from the cache failed |
| services.cache.not_connected<br/><pre>0x01030003</pre>  | [ServiceUnavailableError](/core/2/api/errors/error-codes#serviceunavailableerror) <pre>(503)</pre> | Unable to connect to the cache server. | Unable to connect to the cache server |
| services.cache.write_failed<br/><pre>0x01030004</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cache write fail: %s | An attempt to write to the cache failed |

---


### Subdomain: 0x0104: statistics

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| services.statistics.not_available<br/><pre>0x01040001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Statistics module is not available. | The statistics module is not enabled. See "config.stats.enabled". |

---
