---
code: true
type: page
title: "0x01: services"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x01: services



### Subdomain: 0x0101: storage

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| services.storage.unknown_index<br/><pre>0x01010001</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The provided data index does not exist |
| services.storage.unknown_collection<br/><pre>0x01010002</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The provided data collection does not exist |
| services.storage.get_limit_exceeded<br/><pre>0x01010003</pre> | [SizeLimitError](/core/2/api/essentials/error-handling#sizelimiterror) <pre>(413)</pre> | The number of documents returned by this request exceeds the configured server limit |
| services.storage.write_limit_exceeded<br/><pre>0x01010004</pre> | [SizeLimitError](/core/2/api/essentials/error-handling#sizelimiterror) <pre>(413)</pre> | The number of documents edited by this request exceeds the configured server limit |
| services.storage.import_failed<br/><pre>0x01010005</pre> | [PartialError](/core/2/api/essentials/error-handling#partialerror) <pre>(206)</pre> | Failed to import some or all documents |
| services.storage.no_multi_indexes<br/><pre>0x01010006</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple indexes |
| services.storage.no_multi_collections<br/><pre>0x01010007</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple collections |
| services.storage.incomplete_delete<br/><pre>0x01010009</pre> | [PartialError](/core/2/api/essentials/error-handling#partialerror) <pre>(206)</pre> | Couldn't delete all the requested documents |
| services.storage.not_found<br/><pre>0x0101000b</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Document not found |
| services.storage.bootstrap_timeout<br/><pre>0x0101000c</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Bootstrap of a storage instance failed because it has been locked for too much time |
| services.storage.version_mismatch<br/><pre>0x0101000d</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | The version of the target Elasticsearch is not compatible with this version of Kuzzle |
| services.storage.unknown_scroll_id<br/><pre>0x0101000e</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | The scroll identifier does not exist or has expired |
| services.storage.search_as_an_id<br/><pre>0x0101000f</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Used "_search" as a document identifier, which conflicts with the _search HTTP route |
| services.storage.unknown_index_collection<br/><pre>0x01010010</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The provided index and/or collection doesn't exist |
| services.storage.document_already_exists<br/><pre>0x01010011</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A document with the same identifier already exists |
| services.storage.missing_argument<br/><pre>0x01010012</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A required argument is missing or is empty |
| services.storage.invalid_argument<br/><pre>0x01010013</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Invalid argument provided |
| services.storage.index_protected<br/><pre>0x01010014</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The content of a protected index cannot be modified with generic API routes |
| services.storage.invalid_mapping<br/><pre>0x01010015</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The provided mapping is invalid |
| services.storage.collection_reserved<br/><pre>0x01010016</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Collections cannot be named "_kuzzle_keep" because it is reserved for internal use. |
| services.storage.no_routing<br/><pre>0x01010017</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The "_routing" keyword is forbidden |
| services.storage.not_connected<br/><pre>0x01010018</pre> | [ExternalServiceError](/core/2/api/essentials/error-handling#externalserviceerror) <pre>(500)</pre> | Unable to connect to the storage instance |
| services.storage.too_many_operations<br/><pre>0x01010019</pre> | [ExternalServiceError](/core/2/api/essentials/error-handling#externalserviceerror) <pre>(500)</pre> | Too many operations received |
| services.storage.cannot_change_mapping<br/><pre>0x0101001a</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Cannot change the mapping of a field (once set, a field mapping cannot be changed) |
| services.storage.duplicate_field_mapping<br/><pre>0x0101001b</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A same field cannot have different mappings within the same index (fields are shared to all of an index collections) |
| services.storage.unexpected_properties<br/><pre>0x0101001c</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Unexpected properties found |
| services.storage.invalid_mapping_type<br/><pre>0x0101001d</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Unrecognized mapping data type |
| services.storage.wrong_mapping_property<br/><pre>0x0101001e</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A mapping property cannot be parsed |
| services.storage.invalid_mapping_argument<br/><pre>0x0101001f</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Invalid mapping property |
| services.storage.too_many_changes<br/><pre>0x01010020</pre> | [ExternalServiceError](/core/2/api/essentials/error-handling#externalserviceerror) <pre>(500)</pre> | Too many changes occured on the same resource in a small amount of time. Try with the "retryOnConflict" option |
| services.storage.unexpected_bad_request<br/><pre>0x01010021</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Embeds an unexpected bad request error from Elasticsearch |
| services.storage.unexpected_not_found<br/><pre>0x01010022</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Embeds an unexpected notfound error from Elasticsearch |
| services.storage.unexpected_error<br/><pre>0x01010023</pre> | [ExternalServiceError](/core/2/api/essentials/error-handling#externalserviceerror) <pre>(500)</pre> | Embeds an unexpected error from Elasticsearch |
| services.storage.no_mapping_found<br/><pre>0x01010025</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to read a non-existent mapping |
| services.storage.index_already_exists<br/><pre>0x01010026</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Attempted to create an already existing index |
| services.storage.invalid_search_query<br/><pre>0x01010028</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A forbidden argument has been provided in the search query |
| services.storage.invalid_index_name<br/><pre>0x01010029</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A provided index name is invalid |
| services.storage.invalid_collection_name<br/><pre>0x0101002a</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A provided collection name is invalid |

---


### Subdomain: 0x0103: cache

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| services.cache.database_not_found<br/><pre>0x01030001</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Unknown cache database name |
| services.cache.read_failed<br/><pre>0x01030002</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | An attempt to read from the cache failed |
| services.cache.not_connected<br/><pre>0x01030003</pre> | [ServiceUnavailableError](/core/2/api/essentials/error-handling#serviceunavailableerror) <pre>(503)</pre> | Unable to connect to the cache server |
| services.cache.write_failed<br/><pre>0x01030004</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | An attempt to write to the cache failed |

---
