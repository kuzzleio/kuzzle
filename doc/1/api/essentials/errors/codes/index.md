---
code: false
type: page
title: Codes
description: error codes definitions
order: 500
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# Error codes



## 0x00: core



### Subdomain: 0x0000: fatal

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.fatal.unexpected_error<br/><pre>0x00000001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Caught an unexpected error. Please contact your support. |
| core.fatal.service_unavailable<br/><pre>0x00000002</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | An external service is unavailable |
| core.fatal.service_timeout<br/><pre>0x00000003</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Service initialization timeout |
| core.fatal.unreadable_log_dir<br/><pre>0x00000004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Cannot read the content of the log directory |
| core.fatal.assertion_failed<br/><pre>0x00000005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | A runtime assertion has failed. Please contact support. |

---


### Subdomain: 0x0001: realtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.realtime.room_not_found<br/><pre>0x00010001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | The provided room identifier doesn't exist |
| core.realtime.invalid_rooms<br/><pre>0x00010002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The provided "rooms" argument is invalid |
| core.realtime.invalid_state<br/><pre>0x00010003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An invalid value has been provided to the "state" argument |
| core.realtime.invalid_scope<br/><pre>0x00010004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An invalid value has been provided to the "scope" argument |
| core.realtime.invalid_users<br/><pre>0x00010005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An invalid value has been provided to the "users" argument |
| core.realtime.too_many_terms<br/><pre>0x00010006</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The number of filter terms exceeds the configured server limit |
| core.realtime.too_many_rooms<br/><pre>0x00010007</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The configured number of unique rooms has been reached |
| core.realtime.not_subscribed<br/><pre>0x00010008</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Tried to manage a room while not having subscribed to it |

---


### Subdomain: 0x0002: vault

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.vault.cannot_decrypt<br/><pre>0x00020001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Decryption of a vault file failed |
| core.vault.key_not_found<br/><pre>0x00020002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | A vault file has been provided without a vault key |

---


### Subdomain: 0x0003: configuration

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.configuration.invalid_type<br/><pre>0x00030001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Wrong configuration parameter type |
| core.configuration.out_of_range<br/><pre>0x00030002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | A configuration value exceeds the allowed range |

---


### Subdomain: 0x0004: sandbox

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.sandbox.process_already_running<br/><pre>0x00040001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | A process is already running for this sandbox |
| core.sandbox.timeout<br/><pre>0x00040002</pre> | [GatewayTimeoutError](/core/1/api/essentials/errors/handling#gatewaytimeouterror) <pre>(504)</pre> | Sandbox execution timed out |

---

---

## 0x01: services



### Subdomain: 0x0101: storage

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| services.storage.unknown_index<br/><pre>0x01010001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The provided data index does not exist |
| services.storage.unknown_collection<br/><pre>0x01010002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The provided data collection does not exist |
| services.storage.get_limit_exceeded<br/><pre>0x01010003</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The number of documents returned by this request exceeds the configured server limit |
| services.storage.write_limit_exceeded<br/><pre>0x01010004</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The number of documents edited by this request exceeds the configured server limit |
| services.storage.import_failed<br/><pre>0x01010005</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Failed to import some or all documents |
| services.storage.no_multi_indexes<br/><pre>0x01010006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple indexes |
| services.storage.no_multi_collections<br/><pre>0x01010007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot be run on multiple collections |
| services.storage.incomplete_fetch<br/><pre>0x01010008</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Couldn't retrieve all the requested documents |
| services.storage.incomplete_delete<br/><pre>0x01010009</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Couldn't delete all the requested documents |
| services.storage.incomplete_create<br/><pre>0x0101000a</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Couldn't create all the requested documents |
| services.storage.not_found<br/><pre>0x0101000b</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Document not found |
| services.storage.bootstrap_timeout<br/><pre>0x0101000c</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Bootstrap of a storage instance failed because it has been locked for too much time |
| services.storage.version_mismatch<br/><pre>0x0101000d</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | The version of the target Elasticsearch is not compatible with this version of Kuzzle |
| services.storage.unknown_scroll_id<br/><pre>0x0101000e</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | The scroll identifier does not exist or has expired |
| services.storage.search_as_an_id<br/><pre>0x0101000f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Used "_search" as a document identifier, which conflicts with the _search HTTP route |
| services.storage.unknown_index_collection<br/><pre>0x01010010</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The provided index and/or collection doesn't exist |
| services.storage.document_already_exists<br/><pre>0x01010011</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A document with the same identifier already exists |
| services.storage.missing_argument<br/><pre>0x01010012</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A required argument is missing or is empty |
| services.storage.invalid_argument<br/><pre>0x01010013</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid argument provided |
| services.storage.index_protected<br/><pre>0x01010014</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The content of a protected index cannot be modified with generic API routes |
| services.storage.invalid_mapping<br/><pre>0x01010015</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The provided mapping is invalid |
| services.storage.index_reserved<br/><pre>0x01010016</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Index names starting with a "%" are reserved and cannot be used |
| services.storage.no_routing<br/><pre>0x01010017</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The "_routing" keyword is forbidden |
| services.storage.not_connected<br/><pre>0x01010018</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Unable to connect to the storage instance |
| services.storage.too_many_operations<br/><pre>0x01010019</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Too many operations received |
| services.storage.cannot_change_mapping<br/><pre>0x0101001a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot change the mapping of a field (once set, a field mapping cannot be changed) |
| services.storage.duplicate_field_mapping<br/><pre>0x0101001b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A same field cannot have different mappings within the same index (fields are shared to all of an index collections) |
| services.storage.unexpected_properties<br/><pre>0x0101001c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unexpected properties found |
| services.storage.invalid_mapping_type<br/><pre>0x0101001d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unrecognized mapping data type |
| services.storage.wrong_mapping_property<br/><pre>0x0101001e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A mapping property cannot be parsed |
| services.storage.invalid_mapping_argument<br/><pre>0x0101001f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid mapping property |
| services.storage.too_many_changes<br/><pre>0x01010020</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Too many changes occured on the same resource in a small amount of time. Try with the "retryOnConflict" option |
| services.storage.unexpected_bad_request<br/><pre>0x01010021</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Embeds an unexpected bad request error from Elasticsearch |
| services.storage.unexpected_not_found<br/><pre>0x01010022</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Embeds an unexpected notfound error from Elasticsearch |
| services.storage.unexpected_error<br/><pre>0x01010023</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Embeds an unexpected error from Elasticsearch |
| services.storage.no_mapping_found<br/><pre>0x01010025</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to read a non-existent mapping |

---


### Subdomain: 0x0103: cache

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| services.cache.database_not_found<br/><pre>0x01030001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unknown cache database name |
| services.cache.read_failed<br/><pre>0x01030002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | An attempt to read from the cache failed |
| services.cache.not_connected<br/><pre>0x01030003</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Unable to connect to the cache server |
| services.cache.write_failed<br/><pre>0x01030004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | An attempt to write to the cache failed |

---

---

## 0x02: api



### Subdomain: 0x0201: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.assert.invalid_type<br/><pre>0x02010001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Wrong argument type |
| api.assert.invalid_argument<br/><pre>0x02010002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A request argument holds an invalid value |
| api.assert.missing_argument<br/><pre>0x02010003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A required argument is missing |
| api.assert.empty_argument<br/><pre>0x02010004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The argument cannot be empty |
| api.assert.mutually_exclusive<br/><pre>0x02010005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Mutually exclusive parameters have been provided |
| api.assert.too_many_arguments<br/><pre>0x02010006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An argument contains too many keys or values |
| api.assert.unexpected_argument<br/><pre>0x02010007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An unexpected argument has been provided |
| api.assert.body_required<br/><pre>0x02010008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A request body is required |
| api.assert.unexpected_type_assertion<br/><pre>0x02010009</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unexpected type assertion |
| api.assert.invalid_id<br/><pre>0x0201000a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | _id values cannot start with an underscore |
| api.assert.forbidden_argument<br/><pre>0x0201000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | A forbidden argument has been provided |

---


### Subdomain: 0x0202: process

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.process.action_locked<br/><pre>0x02020001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Cannot execute the requested action because it's already executing |
| api.process.overloaded<br/><pre>0x02020002</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | The request has been discarded because the server is overloaded |
| api.process.connection_dropped<br/><pre>0x02020003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request has been discarded because its linked client connection has dropped |
| api.process.controller_not_found<br/><pre>0x02020004</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | API controller not found |
| api.process.action_not_found<br/><pre>0x02020005</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | API controller action not found |
| api.process.incompatible_sdk_version<br/><pre>0x02020006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | SDK is incompatible with the current Kuzzle version |

---

---

## 0x03: network



### Subdomain: 0x0301: http

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.http.request_too_large<br/><pre>0x03010001</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The size of the request exceeds the server configured limit |
| network.http.unexpected_error<br/><pre>0x03010002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected HTTP parsing error |
| network.http.too_many_encodings<br/><pre>0x03010003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The number of encodings exceeds the server configured limit |
| network.http.unsupported_compression<br/><pre>0x03010004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request has been compressed using an unsupported compression algorithm |
| network.http.compression_disabled<br/><pre>0x03010005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The server has been configured to refuse compressed requests |
| network.http.unsupported_verb<br/><pre>0x03010006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An HTTP request has been submitted using an unsupported verb |
| network.http.url_not_found<br/><pre>0x03010007</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | API URL not found |
| network.http.unsupported_content<br/><pre>0x03010008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The content described in the content-type header is not supported |
| network.http.unsupported_charset<br/><pre>0x03010009</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unsupported content charset |
| network.http.duplicate_url<br/><pre>0x0301000a</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Triggered when an attempt is made to register a duplicate URL in the HTTP router |
| network.http.volatile_parse_failed<br/><pre>0x0301000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The x-kuzzle-volatile header received is not in JSON format |
| network.http.body_parse_failed<br/><pre>0x0301000c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request body is not in JSON format |
| network.http.file_too_large<br/><pre>0x0301000d</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | The submitted file exceeds the server configured limit |

---


### Subdomain: 0x0302: mqtt

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.mqtt.unexpected_error<br/><pre>0x03020001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected MQTT error |

---


### Subdomain: 0x0303: websocket

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.websocket.unexpected_error<br/><pre>0x03030001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Caught an unexpected WebSocket error |

---


### Subdomain: 0x0304: entrypoint

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.entrypoint.unexpected_event<br/><pre>0x03040001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Received an erroneous network event |
| network.entrypoint.invalid_port<br/><pre>0x03040002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid network port |

---

---

## 0x04: plugin



### Subdomain: 0x0401: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.assert.invalid_plugins_dir<br/><pre>0x04010001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | The enabled plugins directory cannot be opened |
| plugin.assert.cannot_load<br/><pre>0x04010002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Kuzzle is unable to load a plugin |
| plugin.assert.invalid_hook<br/><pre>0x04010003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A hook must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.invalid_pipe<br/><pre>0x04010004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A pipe must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.init_not_found<br/><pre>0x04010005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin does not have an 'init' function |
| plugin.assert.privileged_not_supported<br/><pre>0x04010006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The 'privileged' flag has been set in Kuzzle's configuration for that plugin, but not in the plugin's manifest |
| plugin.assert.privileged_not_set<br/><pre>0x04010007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The 'privileged' flag has been set in the plugin's manifest file, but it needs also to be added in Kuzzle's configuration |
| plugin.assert.not_a_constructor<br/><pre>0x04010008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The exposed plugin is not a constructor |
| plugin.assert.name_already_exists<br/><pre>0x04010009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Another plugin with the same name has already been loaded |

---


### Subdomain: 0x0402: runtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.runtime.failed_init<br/><pre>0x04020001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | An exception was thrown by a plugin's init function |
| plugin.runtime.unexpected_error<br/><pre>0x04020002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Embeds an unexpected plugin error into a standardized KuzzleError object |
| plugin.runtime.pipe_timeout<br/><pre>0x04020003</pre> | [GatewayTimeoutError](/core/1/api/essentials/errors/handling#gatewaytimeouterror) <pre>(504)</pre> | A pipe function execution took more than the configured server limit |

---


### Subdomain: 0x0403: strategy

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.strategy.invalid_description<br/><pre>0x04030001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.description field must be an object |
| plugin.strategy.invalid_methods<br/><pre>0x04030002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.methods field must be an object |
| plugin.strategy.invalid_method_type<br/><pre>0x04030003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Method definitions in the strategy.methods configuration must be of type string |
| plugin.strategy.missing_method_function<br/><pre>0x04030004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A required strategy method is missing |
| plugin.strategy.invalid_config<br/><pre>0x04030005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.config field must be an object |
| plugin.strategy.unexpected_constructor<br/><pre>0x04030006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The (deprecated) constructor property can only be set if there is no authenticator defined |
| plugin.strategy.invalid_constructor<br/><pre>0x04030007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.constructor field must be a constructor |
| plugin.strategy.invalid_authenticator<br/><pre>0x04030008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.authenticator field must be a string |
| plugin.strategy.unknown_authenticator<br/><pre>0x04030009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | This strategy uses an authenticator that hasn't been declared in this.authenticators |
| plugin.strategy.invalid_option<br/><pre>0x0403000a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | If defined, the "strategy.config.strategyOptions" and "strategy.config.authenticateOptions" properties must be objects |
| plugin.strategy.invalid_fields<br/><pre>0x0403000b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The field strategy.config.fields must be an array or null |
| plugin.strategy.invalid_definition<br/><pre>0x0403000c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The strategies property must be a non-empty object |
| plugin.strategy.failed_registration<br/><pre>0x0403000d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Passportjs rejected this strategy (see the message for more information) |
| plugin.strategy.invalid_verify_return<br/><pre>0x0403000e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method must return a promise |
| plugin.strategy.invalid_verify_resolve<br/><pre>0x0403000f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" strategy method resolved to a non-object return value |
| plugin.strategy.invalid_kuid<br/><pre>0x04030010</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method returned an invalid kuid |
| plugin.strategy.unknown_kuid<br/><pre>0x04030011</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method returned an unknown kuid |
| plugin.strategy.unauthorized_removal<br/><pre>0x04030012</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Tried to remove a strategy owned by another plugin |
| plugin.strategy.strategy_not_found<br/><pre>0x04030013</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to remove a non-existent authentication strategy |
| plugin.strategy.missing_user<br/><pre>0x04030014</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | A strategy plugin approved credentials without providing a user object to Kuzzle |

---


### Subdomain: 0x0404: controller

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.controller.invalid_description<br/><pre>0x04040001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The controller description must be an object |
| plugin.controller.invalid_action<br/><pre>0x04040002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A controller action must be a function name, or a function |
| plugin.controller.unexpected_route_property<br/><pre>0x04040003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | An unexpected property has been found in a controller route definition |
| plugin.controller.invalid_route_property<br/><pre>0x04040004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid route property format (must be a non-empty string) |
| plugin.controller.undefined_controller<br/><pre>0x04040005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route points to an non-existent controller |
| plugin.controller.undefined_action<br/><pre>0x04040006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route points to an non-existent controller action |
| plugin.controller.unsupported_verb<br/><pre>0x04040007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route is using an unsupported HTTP verb |
| plugin.controller.unserializable_response<br/><pre>0x04040008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A plugin controller action returned a non-serializable response |
| plugin.controller.invalid_action_response<br/><pre>0x04040009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | API actions added by plugins must return a promise |

---


### Subdomain: 0x0405: manifest

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.manifest.cannot_load<br/><pre>0x04050001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load the plugin's manifest file |
| plugin.manifest.version_mismatch<br/><pre>0x04050002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Current Kuzzle's version does not match the plugin's requirements |
| plugin.manifest.invalid_name_type<br/><pre>0x04050003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid plugin's name |
| plugin.manifest.invalid_name<br/><pre>0x04050004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid characters in a plugin's name |
| plugin.manifest.missing_name<br/><pre>0x04050005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A plugin name is required |
| plugin.manifest.invalid_errors<br/><pre>0x04050006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The 'errors' property format is invalid |
| plugin.manifest.invalid_privileged<br/><pre>0x04050007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "privileged" property is invalid |
| plugin.manifest.missing_package<br/><pre>0x04050008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin is missing a 'package.json' file (run 'npm init' to create one) |
| plugin.manifest.missing_package_name<br/><pre>0x04050009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A 'name' property in the 'package.json' file is required by Kuzzle, as it is used as the plugin's unique name |

---


### Subdomain: 0x0406: context

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.context.missing_collection<br/><pre>0x04060001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The 'collection' argument is required, but none was provided |
| plugin.context.unavailable_realtime<br/><pre>0x04060002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Due to technical limitations, plugins have limited access to the realtime API controller |
| plugin.context.invalid_user<br/><pre>0x04060003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The user object provided to the sdk.as() method is not of type User |
| plugin.context.invalid_callback<br/><pre>0x04060004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A non-function callback has been provided |
| plugin.context.missing_request<br/><pre>0x04060005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A Request object is required, but none was supplied |
| plugin.context.missing_request_data<br/><pre>0x04060006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A Request object and/or request data must be provided |
| plugin.context.invalid_event<br/><pre>0x04060007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid event name (colons are not allowed in event names) |
| plugin.context.missing_authenticator<br/><pre>0x04060008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Missing "strategy.config.authenticator" property |

---


### Subdomain: 0x0407: authenticators

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.authenticators.not_an_object<br/><pre>0x04070001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The "authenticators" property must be an object |
| plugin.authenticators.invalid_authenticator<br/><pre>0x04070002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Authenticators exposed in the "authenticators" object must be constructors |

---

---

## 0x05: validation



### Subdomain: 0x0501: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.assert.missing_nested_spec<br/><pre>0x05010001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | All levels of an object have to be defined in the specification |
| validation.assert.unexpected_children<br/><pre>0x05010002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The field configuration does not allow children fields |
| validation.assert.missing_parent<br/><pre>0x05010003</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Missing parent field |
| validation.assert.unexpected_properties<br/><pre>0x05010004</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Unexpected properties found |
| validation.assert.missing_type<br/><pre>0x05010005</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The property "type" is required |
| validation.assert.unknown_type<br/><pre>0x05010006</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Unknown "type" defined |
| validation.assert.missing_value<br/><pre>0x05010007</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The "value" field is required |
| validation.assert.invalid_type<br/><pre>0x05010008</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Wrong parameter type |
| validation.assert.not_multivalued<br/><pre>0x05010009</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Expected the field to be multivalued |
| validation.assert.invalid_range<br/><pre>0x0501000a</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | A range has been defined with its lower bound greater than its upper one |
| validation.assert.invalid_specifications<br/><pre>0x0501000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The provided specifications are invalid |
| validation.assert.not_found<br/><pre>0x0501000c</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existent collection specifications |
| validation.assert.invalid_filters<br/><pre>0x0501000d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The Koncorde filters provided as a validator are invalid |

---


### Subdomain: 0x0502: types

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.types.invalid_date_format<br/><pre>0x05020001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | One or multiple date format types are invalid |
| validation.types.invalid_date<br/><pre>0x05020002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The date value is invalid and cannot be parsed |
| validation.types.missing_enum_values<br/><pre>0x05020003</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The "enum" type requires a "values" property holding the list of the enum values |
| validation.types.invalid_geoshape<br/><pre>0x05020004</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | One or multiple geoshape types are invalid |
| validation.types.missing_type_name<br/><pre>0x05020005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Type definitions must have a "typeName" defined |
| validation.types.missing_function<br/><pre>0x05020006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A required function is missing from the new validation data type |
| validation.types.already_exists<br/><pre>0x05020007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Duplicate data type definition |

---


### Subdomain: 0x0503: check

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.check.failed_document<br/><pre>0x05030001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Document rejected because it does not validate the collection specifications |
| validation.check.failed_field<br/><pre>0x05030002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Document rejected because one of its field does not validate the collection specifications |

---

---

## 0x06: protocol



### Subdomain: 0x0601: runtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| protocol.runtime.invalid_connection<br/><pre>0x06010001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Connection objects must have both their id and protocol set |
| protocol.runtime.unknown_connection<br/><pre>0x06010002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The provided connection identifier is unknown |
| protocol.runtime.already_exists<br/><pre>0x06010003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A protocol of the same name already exists |

---

---

## 0x07: security



### Subdomain: 0x0701: token

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.token.invalid<br/><pre>0x07010001</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Invalid authentication token. |
| security.token.unknown_user<br/><pre>0x07010002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Missing user or missing user identifier |
| security.token.unknown_connection<br/><pre>0x07010003</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Missing connection identifier |
| security.token.ttl_exceeded<br/><pre>0x07010004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An authentication token was requested with a TTL larger than the configured maximum value |
| security.token.generation_failed<br/><pre>0x07010005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unable to generate the requested authentication token |
| security.token.expired<br/><pre>0x07010006</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | The provided authentication token has expired |
| security.token.verification_error<br/><pre>0x07010007</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | An unexpected error occured while verifying an authentication token |

---


### Subdomain: 0x0702: credentials

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.credentials.unknown_strategy<br/><pre>0x07020001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unknown authentication strategy |
| security.credentials.database_inconsistency<br/><pre>0x07020002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Inconsistency detected: credentials were found on a non-existing user |
| security.credentials.rejected<br/><pre>0x07020003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | User's credentials were rejected during |

---


### Subdomain: 0x0703: rights

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.rights.unauthorized<br/><pre>0x07030001</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Authentication required |
| security.rights.forbidden<br/><pre>0x07030002</pre> | [ForbiddenError](/core/1/api/essentials/errors/handling#forbiddenerror) <pre>(403)</pre> | Insufficient permissions to execute this action |

---


### Subdomain: 0x0704: user

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.user.already_exists<br/><pre>0x07040001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Cannot create the user as it already exists |
| security.user.not_found<br/><pre>0x07040002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing user |
| security.user.anonymous_profile_required<br/><pre>0x07040003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The anonymous user must be assigned to the anonymous profile |
| security.user.cannot_hydrate<br/><pre>0x07040004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Database inconsistency error: a user is referencing non-existing profiles |
| security.user.uninitialized<br/><pre>0x07040005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized User object |

---


### Subdomain: 0x0705: role

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.role.not_found<br/><pre>0x07050001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing role |
| security.role.login_required<br/><pre>0x07050002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot remove the "login" action from the anonymous role |
| security.role.cannot_delete<br/><pre>0x07050003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Attempted to delete a base role (anonymous, default, admin) |
| security.role.in_use<br/><pre>0x07050004</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | A role still assigned to profiles cannot be deleted |
| security.role.uninitialized<br/><pre>0x07050005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized Role object |
| security.role.invalid_rights<br/><pre>0x07050006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid rights |
| security.role.closure_exec_failed<br/><pre>0x07050007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Execution failed on the provided closure |
| security.role.closure_missing_test<br/><pre>0x07050008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Closures must specify a "test" attribute |

---


### Subdomain: 0x0706: profile

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.profile.not_found<br/><pre>0x07060001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing profile |
| security.profile.cannot_delete<br/><pre>0x07060002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Attempted to delete a base profile (anonymous, default, admin) |
| security.profile.in_use<br/><pre>0x07060003</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | A profile still assigned to users cannot be deleted |
| security.profile.cannot_hydrate<br/><pre>0x07060004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Database inconsistency error: a profile is referencing non-existing roles |
| security.profile.missing_anonymous_role<br/><pre>0x07060005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The anonymous profile must include the anonymous role |
| security.profile.uninitialized<br/><pre>0x07060006</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized Profile object |

---

---
