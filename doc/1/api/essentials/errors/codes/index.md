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



## 0x00: internal



### Subdomain: 0x0000: unexpected

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.unexpected.unknown_error<br/><pre>0x00000001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unknown error: &lt;placeholder&gt;. |
| internal.unexpected.timeout<br/><pre>0x00000002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | [FATAL] Service "&lt;placeholder&gt;[&lt;placeholder&gt;]" failed to init within &lt;placeholder&gt;ms |

---


### Subdomain: 0x0001: external_services

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.external_services.service_unavailable<br/><pre>0x00010001</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Service unavailable: &lt;placeholder&gt;. |

---


### Subdomain: 0x0002: hotelclerk

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.hotelclerk.room_id_not_exists<br/><pre>0x00020001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | The room Id "&lt;placeholder&gt;" does not exist. |
| internal.hotelclerk.subscription_not_found<br/><pre>0x00020002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | No subscription found on index &lt;placeholder&gt; and collection &lt;placeholder&gt;. |
| internal.hotelclerk.rooms_attribute_type<br/><pre>0x00020003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The rooms attribute must be an array. |
| internal.hotelclerk.incorrect_state_value<br/><pre>0x00020004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Incorrect value for the 'state' parameter. Expected: all, done or pending. Got: &lt;placeholder&gt;. |
| internal.hotelclerk.incorrect_scope_value<br/><pre>0x00020005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Incorrect value for the 'scope' parameter. Expected: all, done or pending. Got: &lt;placeholder&gt;. |
| internal.hotelclerk.incorrect_users_value<br/><pre>0x00020006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Incorrect value for the 'users' parameter. Expected: all, done or pending. Got: &lt;placeholder&gt;. |
| internal.hotelclerk.missing_subscription_parameter<br/><pre>0x00020007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot subscribe without an index and a collection. |
| internal.hotelclerk.limit_minterms_reached<br/><pre>0x00020008</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Unable to subscribe: maximum number of minterms exceeded (max &lt;placeholder&gt;, received &lt;placeholder&gt;). |
| internal.hotelclerk.limit_unique_rooms_reached<br/><pre>0x00020009</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Unable to subscribe: maximum number of unique rooms reached. |
| internal.hotelclerk.cant_unsubscribe_unknown_user<br/><pre>0x0002000a</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unsubscribe error: no subscription found for that user. |
| internal.hotelclerk.cant_unsubscribe_user_not_subscribed<br/><pre>0x0002000b</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unsubscribe error: not subscribed to &lt;placeholder&gt;. |
| internal.hotelclerk.cant_unsubscribe_unknown_room<br/><pre>0x0002000c</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unsubscribe error: room &lt;placeholder&gt; not found. |

---


### Subdomain: 0x0003: janitor

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.janitor.import_data<br/><pre>0x00030001</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some data was not imported for &lt;placeholder&gt;/&lt;placeholder&gt; (&lt;placeholder&gt;/&lt;placeholder&gt;). |
| internal.janitor.dump_already_generated<br/><pre>0x00030002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | A dump is already being generated. Skipping. |
| internal.janitor.reading_log_directory<br/><pre>0x00030003</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Cannot read log directory '&lt;placeholder&gt;' : &lt;placeholder&gt;. |

---


### Subdomain: 0x0004: vault

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.vault.decrypt_secrets<br/><pre>0x00040001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Cannot decrypt secrets: &lt;placeholder&gt;. |
| internal.vault.vault_key_not_found<br/><pre>0x00040002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Cannot find vault key. Aborting. |

---


### Subdomain: 0x0005: plugins

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.plugins.invalid_plugin_name<br/><pre>0x00050001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores. |
| internal.plugins.invalid_privileged_property<br/><pre>0x00050002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Invalid "privileged" property: expected a boolean, got a &lt;placeholder&gt;. |
| internal.plugins.missing_package_json<br/><pre>0x00050003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No package.json file found. |
| internal.plugins.missing_name_property_in_package_json<br/><pre>0x00050004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No "name" property provided in package.json. |
| internal.plugins.invalid_user_object<br/><pre>0x00050005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | You must provide a valid User object when adding context with as(). |
| internal.plugins.collection_not_specified<br/><pre>0x00050006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The collection must be specified. |
| internal.plugins.callback_argument_expected<br/><pre>0x00050007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: Expected callback to be a function, received "&lt;placeholder&gt;". |
| internal.plugins.missing_request_object<br/><pre>0x00050008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: a Request object must be supplied. |
| internal.plugins.invalid_custom_event_name<br/><pre>0x00050009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Custom event invalid name (&lt;placeholder&gt;). Colons are not allowed in custom events. |
| internal.plugins.missing_request_data_or_object<br/><pre>0x0005000a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A Request object and/or request data must be provided. |
| internal.plugins.invalid_strategy_registration<br/><pre>0x0005000b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Strategy &lt;placeholder&gt;: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk). |
| internal.plugins.plugin_initialization_failed<br/><pre>0x0005000c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Something went wrong during initialization of "&lt;placeholder&gt;" plugin. |
| internal.plugins.strategy_description_type<br/><pre>0x0005000d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the strategy description to be an object, got: &lt;placeholder&gt;. |
| internal.plugins.methods_property_type<br/><pre>0x0005000e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "methods" property of type "object", got: &lt;placeholder&gt;. |
| internal.plugins.methodname_property_type<br/><pre>0x0005000f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "&lt;placeholder&gt;" property of type "string", got: &lt;placeholder&gt;. |
| internal.plugins.invalid_strategy_method<br/><pre>0x00050010</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the strategy method "&lt;placeholder&gt;" must point to an exposed function. |
| internal.plugins.invalid_property_type<br/><pre>0x00050011</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "&lt;placeholder&gt;" property to be of type "string", got: &lt;placeholder&gt;. |
| internal.plugins.missing_config_property<br/><pre>0x00050012</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "config" property of type "object", got: &lt;placeholder&gt;. |
| internal.plugins.cannot_set_ctor_and_authenticator<br/><pre>0x00050013</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the "authenticator" and "constructor" parameters cannot both be set. |
| internal.plugins.invalid_constructor_property_value<br/><pre>0x00050014</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid "constructor" property value: constructor expected. |
| internal.plugins.authenticator_property_type<br/><pre>0x00050015</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected an "authenticator" property of type "string", got: &lt;placeholder&gt;. |
| internal.plugins.unknown_authenticator_value<br/><pre>0x00050016</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; unknown authenticator value: &lt;placeholder&gt;. |
| internal.plugins.expected_object_type<br/><pre>0x00050017</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "&lt;placeholder&gt;" property to be of type "object", got: &lt;placeholder&gt;. |
| internal.plugins.invalid_fields_property_type<br/><pre>0x00050018</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "fields" property to be of type "array", got: &lt;placeholder&gt;. |
| internal.plugins.plugin_threw_non_kuzzle_error<br/><pre>0x00050019</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Plugin &lt;placeholder&gt; pipe for event '&lt;placeholder&gt;' threw a non-Kuzzle error: &lt;placeholder&gt;. |
| internal.plugins.verify_dont_return_promise<br/><pre>0x0005001a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "verify" to return a Promise, got: &lt;placeholder&gt;. |
| internal.plugins.invalid_authentication_strategy_result<br/><pre>0x0005001b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authentication strategy result. |
| internal.plugins.invalid_authentication_kuid<br/><pre>0x0005001c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authentication kuid returned: expected a string, got a &lt;placeholder&gt;. |
| internal.plugins.unkown_kuzzle_user_identifier<br/><pre>0x0005001d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; returned an unknown Kuzzle user identifier. |
| internal.plugins.cannot_remove_others_plugin_strategy<br/><pre>0x0005001e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Cannot remove strategy &lt;placeholder&gt;: owned by another plugin. |
| internal.plugins.cannot_remove_unexistant_strategy<br/><pre>0x0005001f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Cannot remove strategy &lt;placeholder&gt;: strategy does not exist. |
| internal.plugins.incorrect_controller_description_type<br/><pre>0x00050020</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Incorrect controller description type (expected object, got: "&lt;placeholder&gt;"). |
| internal.plugins.unknown_property_key_in_route_definition<br/><pre>0x00050021</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Unknown property "&lt;placeholder&gt;" in route definition. &lt;placeholder&gt; |
| internal.plugins.key_cannot_be_empty_string<br/><pre>0x00050022</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; "&lt;placeholder&gt;" must be a non-empty string. |
| internal.plugins.undefined_controller<br/><pre>0x00050023</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Undefined controller "&lt;placeholder&gt;". &lt;placeholder&gt; |
| internal.plugins.undefined_action<br/><pre>0x00050024</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Undefined action "&lt;placeholder&gt;". &lt;placeholder&gt; |
| internal.plugins.http_verb_not_allowed<br/><pre>0x00050025</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Only following http verbs are allowed: "&lt;placeholder&gt;". &lt;placeholder&gt; |
| internal.plugins.strategies_plugin_property_empty<br/><pre>0x00050026</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the exposed "strategies" plugin property must be a non-empty object. |
| internal.plugins.authenticators_plugin_property_not_an_object<br/><pre>0x00050027</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the exposed "authenticators" plugin property must be of type "object". |
| internal.plugins.invalid_authenticator<br/><pre>0x00050028</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authenticator &lt;placeholder&gt;: expected a constructor. |
| internal.plugins.unable_to_load_plugin_from_directory<br/><pre>0x00050029</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load plugins from directory "&lt;placeholder&gt;"; &lt;placeholder&gt;. |
| internal.plugins.unable_to_load_plugin_from_path<br/><pre>0x0005002a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load plugin from path "&lt;placeholder&gt;"; &lt;placeholder&gt;. |
| internal.plugins.init_method_not_found<br/><pre>0x0005002c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No "init" method found. |
| internal.plugins.privileged_mode_not_supported<br/><pre>0x0005002d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin "&lt;placeholder&gt;" is configured to run in privileged mode, but it does not seem to support it. |
| internal.plugins.privileged_mode_not_setted<br/><pre>0x0005002e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin "&lt;placeholder&gt;" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration. |
| internal.plugins.invalid_user_object_provided<br/><pre>0x00050030</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | FunnelProtocol.constructor: Invalid User object "&lt;placeholder&gt;" |

---


### Subdomain: 0x0006: validation

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.validation.missing_typename_property<br/><pre>0x00060001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The typeName property must be defined in the validation type object. |
| internal.validation.missing_function_validate<br/><pre>0x00060002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The type &lt;placeholder&gt; must implement the function 'validate'. |
| internal.validation.missing_function_validatefieldspecification<br/><pre>0x00060003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The type &lt;placeholder&gt; must implement the function 'validateFieldSpecification'. |
| internal.validation.missing_function_getstrictness<br/><pre>0x00060004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The allowing children type &lt;placeholder&gt; must implement the function 'getStrictness'. |
| internal.validation.type_already_defined<br/><pre>0x00060005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The type &lt;placeholder&gt; is already defined. |
| internal.validation.object_format_error<br/><pre>0x00060006</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | All levels of an object have to be defined in the specification. |
| internal.validation.type_not_allowed<br/><pre>0x00060007</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The field type &lt;placeholder&gt; is not allowed to have children fields. |
| internal.validation.parent_field_not_defined<br/><pre>0x00060008</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The parent field of the field "&lt;placeholder&gt;" is not defined. |
| internal.validation.errorcontext_document<br/><pre>0x00060009</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Document: &lt;placeholder&gt;. |
| internal.validation.invalid_formats_option<br/><pre>0x0006000a</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid "formats" option: must be a non-empty array. |
| internal.validation.unrecognized_format_name<br/><pre>0x0006000b</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Unrecognized format name&lt;placeholder&gt;: &lt;placeholder&gt;. |
| internal.validation.invalid_range_option<br/><pre>0x0006000c</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid "range" option definition. |
| internal.validation.invalid_range<br/><pre>0x0006000d</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid range: min > max. |
| internal.validation.invalid_range_type<br/><pre>0x0006000e</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid "range.&lt;placeholder&gt;" option: must be of type "number". |
| internal.validation.invalid_range_format<br/><pre>0x0006000f</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "&lt;placeholder&gt;": invalid format. |
| internal.validation.unable_to_parse_range_value<br/><pre>0x00060010</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Unable to parse the range value "&lt;placeholder&gt;". |
| internal.validation.notempty_option_type<br/><pre>0x00060011</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "notEmpty" must be of type "boolean". |
| internal.validation.missing_values_option<br/><pre>0x00060012</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "values" is required. |
| internal.validation.values_option_cannot_be_empty<br/><pre>0x00060013</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "values" must be a non-empty array. |
| internal.validation.invalid_values_format<br/><pre>0x00060014</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Values must be of type "string". Invalid value&lt;placeholder&gt;: &lt;placeholder&gt;. |
| internal.validation.shapetypes_option_cannot_be_empty<br/><pre>0x00060015</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "shapeTypes" must be a non-empty array. |
| internal.validation.invalid_shape<br/><pre>0x00060016</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid shape&lt;placeholder&gt;: &lt;placeholder&gt;. |
| internal.validation.strict_option_type<br/><pre>0x00060017</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Option "strict" must be of type "boolean". |
| internal.validation.invalid_length_option<br/><pre>0x00060018</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid "length" option definition. |
| internal.validation.invalid_length_type<br/><pre>0x00060019</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid "length.&lt;placeholder&gt;" option: must be of type "number". |
| internal.validation.invalid_length_range<br/><pre>0x0006001a</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Invalid length range: min > max. |
| internal.validation.invalid_properties_for_collection_specification<br/><pre>0x0006001b</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | &lt;placeholder&gt; |
| internal.validation.structure_collection_validation<br/><pre>0x0006001c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; |
| internal.validation.validator_specification_of_collection_error<br/><pre>0x0006001d</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Validator specification of the collection &lt;placeholder&gt;.&lt;placeholder&gt; triggered an error |
| internal.validation.object_level_undefined_in_specification<br/><pre>0x0006001e</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | All levels of an object have to be defined in the specification. |
| internal.validation.throw_error<br/><pre>0x0006001f</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | &lt;placeholder&gt; |
| internal.validation.manage_error_message<br/><pre>0x00060020</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Field &lt;placeholder&gt;: &lt;placeholder&gt; |
| internal.validation.strictness<br/><pre>0x00060021</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | strictness |
| internal.validation.errorcontext<br/><pre>0x00060022</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Field &lt;placeholder&gt;: &lt;placeholder&gt; |

---


### Subdomain: 0x0007: statistics

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.statistics.invalid_time_value<br/><pre>0x00070001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid time value |

---


### Subdomain: 0x0008: sandbox

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.sandbox.process_already_running<br/><pre>0x00080001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | A process is already running for this sandbox |
| internal.sandbox.timeout<br/><pre>0x00080002</pre> | [GatewayTimeoutError](/core/1/api/essentials/errors/handling#gatewaytimeouterror) <pre>(504)</pre> | Timeout. The sandbox did not respond within &lt;placeholder&gt;ms. |

---


### Subdomain: 0x0009: configuration

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| internal.configuration.invalid_limits_configuration_format<br/><pre>0x00090001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid config.limits configuration format: please check your Kuzzle configuration files |
| internal.configuration.value_out_of_range<br/><pre>0x00090002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid configuration: value set for "&lt;placeholder&gt;" limit is outside the allowed range |
| internal.configuration.concurrentRequests_superior_to_requestsBufferSize<br/><pre>0x00090003</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid configuration: the concurrentRequests limit configuration must be strictly inferior to requestsBufferSize |
| internal.configuration.requestsBufferWarningThreshold_out_of_range<br/><pre>0x00090004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid configuration: limits.requestsBufferWarningThreshold should be comprised between limits.concurrentRequests and limits.requestsBufferSize |

---

---

## 0x01: external



### Subdomain: 0x0101: elasticsearch

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| external.elasticsearch.wrong_elasticsearch_version<br/><pre>0x01010001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Your elasticsearch version is &lt;placeholder&gt;; Only elasticsearch version 5 is currently supported. |
| external.elasticsearch.unknown_scroll_identifier<br/><pre>0x01010002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Non-existing or expired scroll identifier. |
| external.elasticsearch.wrong_get_action<br/><pre>0x01010003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The action _search can't be done with a GET. |
| external.elasticsearch.document_not_found<br/><pre>0x01010004</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Document not found. |
| external.elasticsearch.index_or_collection_does_not_exist<br/><pre>0x01010005</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Index '&lt;placeholder&gt;' and/or collection '&lt;placeholder&gt;' don't exist. |
| external.elasticsearch.document_already_exists<br/><pre>0x01010006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Document already exists. |
| external.elasticsearch.document_id_not_found<br/><pre>0x01010007</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Document with id '&lt;placeholder&gt;' not found. |
| external.elasticsearch.empty_query<br/><pre>0x01010008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Query cannot be empty. |
| external.elasticsearch.document_id_cannot_be_null<br/><pre>0x01010009</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | null is not a valid document ID. |
| external.elasticsearch.index_does_not_exist<br/><pre>0x0101000a</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Index '&lt;placeholder&gt;' does not exist. |
| external.elasticsearch.missing_or_invalid_import_attribute<br/><pre>0x0101000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | import must specify a body attribute 'bulkData' of type Object. |
| external.elasticsearch.missing_data_collection_argument<br/><pre>0x0101000c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing data collection argument. |
| external.elasticsearch.missing_data_index_argument<br/><pre>0x0101000d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing data index argument. |
| external.elasticsearch.index_protected<br/><pre>0x0101000e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Index '&lt;placeholder&gt;' is protected, please use appropriated routes instead. |
| external.elasticsearch.error_on_index_refresh<br/><pre>0x0101000f</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Error refreshing index &lt;placeholder&gt;:
&lt;placeholder&gt;. |
| external.elasticsearch.limit_documents_reached<br/><pre>0x01010010</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Number of documents exceeds the server configured value (&lt;placeholder&gt;). |
| external.elasticsearch.index_reserved<br/><pre>0x01010011</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Indexes starting with a '%' are reserved for internal use. Cannot process index &lt;placeholder&gt;. |
| external.elasticsearch.create_action_does_not_support_routing<br/><pre>0x01010012</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Kuzzle does not support '_routing' in create action. |
| external.elasticsearch.wrong_refresh_parameter<br/><pre>0x01010013</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Refresh parameter only supports the value 'wait_for' or false. |
| external.elasticsearch.incorrect_mapping_property<br/><pre>0x01010014</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Incorrect mapping property "mapping.&lt;placeholder&gt;".&lt;placeholder&gt; |
| external.elasticsearch.too_many_operations<br/><pre>0x01010015</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | "&lt;placeholder&gt;" threads buffer exceeded. Too many operations received at once. |
| external.elasticsearch.invalid_change_from_nested<br/><pre>0x01010016</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not change mapping for field "&lt;placeholder&gt;" from nested to another type. |
| external.elasticsearch.invalid_change_to_nested<br/><pre>0x01010017</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not change mapping for field "&lt;placeholder&gt;" from object to another type. |
| external.elasticsearch.invalid_change_to_scalar<br/><pre>0x01010018</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not change mapping for field "&lt;placeholder&gt;" from object to a scalar type. |
| external.elasticsearch.duplicate_field_name<br/><pre>0x01010019</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not set mapping for field "&lt;placeholder&gt;" on collection "&lt;placeholder&gt;" because the field name is already used in another collection with a different type. |
| external.elasticsearch.invalid_type_change<br/><pre>0x0101001a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not change type of field "&lt;placeholder&gt;" from "&lt;placeholder&gt;" to "&lt;placeholder&gt;". |
| external.elasticsearch.unsupported_parameter_for_field<br/><pre>0x0101001b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Parameter "&lt;placeholder&gt;" is not supported for field "&lt;placeholder&gt;". |
| external.elasticsearch.type_does_not_exist<br/><pre>0x0101001c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Can not set mapping for field "&lt;placeholder&gt;" because type "&lt;placeholder&gt;" does not exist |
| external.elasticsearch.fail_to_parse_field<br/><pre>0x0101001d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Failed to validate value of field "&lt;placeholder&gt;". Are you trying to insert nested value in a non-nested field ? |
| external.elasticsearch.wrong_mapping_property<br/><pre>0x0101001e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Mapping for field "&lt;placeholder&gt;" must be an object with a property "type". |
| external.elasticsearch.too_many_changes<br/><pre>0x0101001f</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Unable to modify document "&lt;placeholder&gt;": cluster sync failed (too many simultaneous changes applied) |
| external.elasticsearch.elasticsearch_service_not_connected<br/><pre>0x01010020</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | Elasticsearch service is not connected. |
| external.elasticsearch.unexpected_bad_request_error<br/><pre>0x01010021</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; |
| external.elasticsearch.unexpected_not_found_error<br/><pre>0x01010022</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | &lt;placeholder&gt; |
| external.elasticsearch.unexpected_conflict_error<br/><pre>0x01010023</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | &lt;placeholder&gt; |
| external.elasticsearch.unexpected_error<br/><pre>0x01010024</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | &lt;placeholder&gt; |
| external.elasticsearch.no_mapping_found<br/><pre>0x01010025</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | No mapping found for index "&lt;placeholder&gt;". |
| external.elasticsearch.index_or_collection_not_found<br/><pre>0x01010026</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Index or collection "&lt;placeholder&gt;" does not exist, please create it first. |

---


### Subdomain: 0x0102: internal_engine

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| external.internal_engine.lock_wait_timeout<br/><pre>0x01020001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Internal engine bootstrap - lock wait timeout exceeded. |
| external.internal_engine.plugin_bootstrap_lock_wait_timeout<br/><pre>0x01020002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Plugin &lt;placeholder&gt; bootstrap - lock wait timeout exceeded. |

---


### Subdomain: 0x0103: redis

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| external.redis.redis_service_not_connected<br/><pre>0x01030001</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Redis service is not connected. |

---

---

## 0x02: api



### Subdomain: 0x0201: base

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.base.invalid_value_type<br/><pre>0x02010001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid '&lt;placeholder&gt;' value (&lt;placeholder&gt;). |

---


### Subdomain: 0x0202: server

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.server.elasticsearch_down<br/><pre>0x02020001</pre> | [ExternalServiceError](/core/1/api/essentials/errors/handling#externalserviceerror) <pre>(500)</pre> | ElasticSearch is down: &lt;placeholder&gt;. |
| api.server.service_unavailable<br/><pre>0x02020002</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Error : &lt;placeholder&gt;. |

---


### Subdomain: 0x0203: document

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.document.not_found<br/><pre>0x02030001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | The document does not exist: &lt;placeholder&gt;. |
| api.document.search_on_multiple_indexes<br/><pre>0x02030002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Search on multiple indexes is not available. |
| api.document.search_on_multiple_collections<br/><pre>0x02030003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Search on multiple collections is not available. |
| api.document.missing_scroll_id<br/><pre>0x02030004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing 'scrollId' argument. |
| api.document.get_limit_reached<br/><pre>0x02030005</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Number of gets to perform exceeds the server configured value ( &lt;placeholder&gt; ). |
| api.document.creation_failed<br/><pre>0x02030006</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some document creations failed : &lt;placeholder&gt;. |
| api.document.deletion_failed<br/><pre>0x02030007</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some document deletions failed : &lt;placeholder&gt;. |
| api.document.some_document_missing<br/><pre>0x02030008</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some document are missing. |

---


### Subdomain: 0x0204: admin

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.admin.database_not_found<br/><pre>0x02040001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Database &lt;placeholder&gt; not found. |
| api.admin.action_locked<br/><pre>0x02040002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Lock action error: &lt;placeholder&gt;. |

---


### Subdomain: 0x0205: auth

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.auth.token_force_expire<br/><pre>0x02050001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Error while forcing token expiration. |
| api.auth.invalid_token<br/><pre>0x02050002</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Invalid token. |
| api.auth.unknown_authentication_strategy<br/><pre>0x02050003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unknown authentication strategy "&lt;placeholder&gt;" |
| api.auth.cannot_generate_token_with_unknown_user<br/><pre>0x02050004</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unknown User : cannot generate token |
| api.auth.cannot_generate_token_with_unknown_context<br/><pre>0x02050005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unknown context : cannot generate token |
| api.auth.expiresIn_limit_reached<br/><pre>0x02050006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | expiresIn value exceeds maximum allowed value |
| api.auth.generate_token_error<br/><pre>0x02050007</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Error while generating token |
| api.auth.token_expired<br/><pre>0x02050008</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Token expired |
| api.auth.json_web_token_error<br/><pre>0x02050009</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Json Web Token Error |
| api.auth.error_verifying_token<br/><pre>0x0205000a</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Error verifying token |

---


### Subdomain: 0x0206: collection

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.collection.index_does_not_exist<br/><pre>0x02060001</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The index &lt;placeholder&gt; does not exist. |
| api.collection.collection_does_not_exist<br/><pre>0x02060002</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | The collection &lt;placeholder&gt; does not exist. |
| api.collection.search_page_size<br/><pre>0x02060003</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Search page size exceeds server configured documents limit ( &lt;placeholder&gt; ). |
| api.collection.invalid_type_argument<br/><pre>0x02060004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Must specify a valid type argument; Expected: 'all', 'stored' or 'realtime'; Received: &lt;placeholder&gt;. |
| api.collection.update_specifications<br/><pre>0x02060005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; |

---


### Subdomain: 0x0207: funnel

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.funnel.server_overloaded<br/><pre>0x02070001</pre> | [ServiceUnavailableError](/core/1/api/essentials/errors/handling#serviceunavailableerror) <pre>(503)</pre> | Request discarded: Kuzzle Server is temporarily overloaded. |
| api.funnel.anonymous_user_permissions<br/><pre>0x02070002</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Unauthorized action [ &lt;placeholder&gt; / &lt;placeholder&gt; / &lt;placeholder&gt; / &lt;placeholder&gt; ] for anonymous user. |
| api.funnel.insufficient_permissions<br/><pre>0x02070003</pre> | [ForbiddenError](/core/1/api/essentials/errors/handling#forbiddenerror) <pre>(403)</pre> | Forbidden action [ &lt;placeholder&gt; / &lt;placeholder&gt; / &lt;placeholder&gt; / &lt;placeholder&gt; ] for user &lt;placeholder&gt;. |
| api.funnel.unknown_controller<br/><pre>0x02070004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unknown controller &lt;placeholder&gt;. |
| api.funnel.unknown_action<br/><pre>0x02070005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | No corresponding action &lt;placeholder&gt; in controller &lt;placeholder&gt;. |
| api.funnel.unauthorized_action<br/><pre>0x02070006</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | Unauthorized action &lt;placeholder&gt; for anonymous user. |
| api.funnel.forbidden_action<br/><pre>0x02070007</pre> | [ForbiddenError](/core/1/api/essentials/errors/handling#forbiddenerror) <pre>(403)</pre> | Forbidden action &lt;placeholder&gt; for user &lt;placeholder&gt;. |
| api.funnel.client_connection_dropped<br/><pre>0x02070008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Client connection dropped |

---


### Subdomain: 0x0208: bulk

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.bulk.document_creations_failed<br/><pre>0x02080001</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some document creations failed: &lt;placeholder&gt;. |
| api.bulk.data_not_imported<br/><pre>0x02080002</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | Some data was not imported: &lt;placeholder&gt;. |

---


### Subdomain: 0x0209: security

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.security.role_not_found<br/><pre>0x02090001</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Role with id &lt;placeholder&gt; not found. |
| api.security.profile_not_found<br/><pre>0x02090002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Profile with id &lt;placeholder&gt; not found. |
| api.security.user_not_found<br/><pre>0x02090003</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | User with id &lt;placeholder&gt; not found. |
| api.security.admin_exists<br/><pre>0x02090004</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Admin user is already set. |
| api.security.cant_create_creds<br/><pre>0x02090005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot create credentials: unknown kuid &lt;placeholder&gt;. |
| api.security.cant_update_creds<br/><pre>0x02090006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot update credentials: unknown kuid &lt;placeholder&gt;. |
| api.security.delete_limit_reached<br/><pre>0x02090007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The number of deletes to perform exceeds the server configured value &lt;placeholder&gt;. |
| api.security.mdelete<br/><pre>0x02090008</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | security:mDelete &lt;placeholder&gt; Error(s) deleting &lt;placeholder&gt; items, &lt;placeholder&gt;. |
| api.security.search_page_size_limit_reached<br/><pre>0x02090009</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Search page size exceeds server configured documents limit &lt;placeholder&gt;. |
| api.security.cant_update_non_existing<br/><pre>0x0209000a</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Cannot update non-existing &lt;placeholder&gt; &lt;placeholder&gt;. |
| api.security.user_already_exists<br/><pre>0x0209000b</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | User &lt;placeholder&gt; already exists. |
| api.security.unknown_strategy<br/><pre>0x0209000c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Strategy &lt;placeholder&gt; is not a known strategy. |
| api.security.creds_on_non_existing_user<br/><pre>0x0209000d</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Internal database inconsistency detected: existing credentials found on non-existing user &lt;placeholder&gt;. |
| api.security.validate_method<br/><pre>0x0209000e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt;. |
| api.security.missing_profile_id<br/><pre>0x0209000f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing profileId |
| api.security.missing_profile_ids<br/><pre>0x02090010</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing profileIds |
| api.security.profile_ids_must_be_array_of_string<br/><pre>0x02090011</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | An array of strings must be provided as profileIds |
| api.security.expected_profile_id_to_be_a_string<br/><pre>0x02090012</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid argument: Expected profile id to be a string, received "&lt;placeholder&gt;" |
| api.security.cannot_delete_basic_profile<br/><pre>0x02090013</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; is one of the basic profiles of Kuzzle, you cannot delete it, but you can edit it. |
| api.security.cannot_delete_profile_being_used<br/><pre>0x02090014</pre> | [ForbiddenError](/core/1/api/essentials/errors/handling#forbiddenerror) <pre>(403)</pre> | The profile "&lt;placeholder&gt;" cannot be deleted since it is used by some users. |
| api.security.missing_anonymous_role<br/><pre>0x02090015</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Anonymous profile must include the anonymous role |
| api.security.unable_to_hydrate_profile<br/><pre>0x02090016</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unable to hydrate the profile &lt;placeholder&gt;: missing role(s) in the database |
| api.security.unable_to_find_collection_with_id<br/><pre>0x02090017</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unable to find &lt;placeholder&gt; with id '&lt;placeholder&gt;' |
| api.security.ids_must_be_an_array<br/><pre>0x02090018</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Bad argument: &lt;placeholder&gt; is not an array. |
| api.security.load_from_cache<br/><pre>0x02090019</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | &lt;placeholder&gt; |
| api.security.nothing_to_delete_in_repository<br/><pre>0x0209001a</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Repository &lt;placeholder&gt;: nothing to delete |
| api.security.missing_id_in_repository<br/><pre>0x0209001b</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Repository &lt;placeholder&gt;: missing _id |
| api.security.missing_role_id<br/><pre>0x0209001c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing role id |
| api.security.expected_role_id_to_be_a_string<br/><pre>0x0209001d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid argument: Expected role id to be a string, received "&lt;placeholder&gt;" |
| api.security.cannot_remove_login_permission_from_anonymous_role<br/><pre>0x0209001e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot remove login permission from anonymous role |
| api.security.cannot_delete_basic_role<br/><pre>0x0209001f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it. |
| api.security.cannot_delete_role_being_used<br/><pre>0x02090020</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The role "&lt;placeholder&gt;" cannot be deleted since it is used by some profile. |
| api.security.unable_remove_bad_credentials<br/><pre>0x02090021</pre> | [PartialError](/core/1/api/essentials/errors/handling#partialerror) <pre>(206)</pre> | was not able to remove bad credentials of user '&lt;placeholder&gt;' |
| api.security.anonymous_user_not_assigned_to_anonymous_profile<br/><pre>0x02090022</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Anonymous user must be assigned the anonymous profile |
| api.security.unable_to_hydrate_user<br/><pre>0x02090023</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | Unable to hydrate the user &lt;placeholder&gt;: missing profile(s) in the database |
| api.security.cannot_get_roles_for_uninitialized_profile<br/><pre>0x02090024</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Cannot get roles for uninitialized profile &lt;placeholder&gt; |
| api.security.missing_mandatory_policies_attribute<br/><pre>0x02090025</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The "policies" attribute is mandatory and must be an array |
| api.security.empty_policies_attribute<br/><pre>0x02090026</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The "policies" attribute array cannot be empty |
| api.security.missing_mandatory_roleId_attribute<br/><pre>0x02090027</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;] Missing mandatory attribute "roleId" |
| api.security.unexpected_attribute_in_policies<br/><pre>0x02090028</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;] Unexpected attribute "&lt;placeholder&gt;". Valid attributes are "roleId" and "restrictedTo" |
| api.security.attribute_restrictedTo_not_an_array_of_objects<br/><pre>0x02090029</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;] Expected "restrictedTo" to be an array of objects |
| api.security.restrictedTo_field_must_be_an_object<br/><pre>0x0209002a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] should be an object |
| api.security.missing_mandatory_index_attribute_in_restrictedTo_array<br/><pre>0x0209002b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] Missing mandatory attribute "index" |
| api.security.index_attribute_is_empty_string<br/><pre>0x0209002c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] Attribute "index" must be a non-empty string value |
| api.security.attribute_collections_not_an_array_in_retrictedTo<br/><pre>0x0209002d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] Attribute "collections" must be of type "array" |
| api.security.attribute_collections_not_contains_not_only_non_empty_strings<br/><pre>0x0209002e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] Attribute "collections" can only contain non-empty string values |
| api.security.unexptected_attribute_in_restrictedTo_array<br/><pre>0x0209002f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | policies[&lt;placeholder&gt;].restrictedTo[&lt;placeholder&gt;] Unexpected attribute "&lt;placeholder&gt;". Valid attributes are "index" and "collections" |
| api.security.cannot_get_profiles_for_uninitialized_user<br/><pre>0x02090030</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Cannot get profiles for uninitialized user &lt;placeholder&gt; |
| api.security.cannot_check_permissions_on_uninitialized_role<br/><pre>0x02090031</pre> | [PreconditionError](/core/1/api/essentials/errors/handling#preconditionerror) <pre>(412)</pre> | Cannot check permissions on uninitialized role &lt;placeholder&gt; |
| api.security.invalid_rights_given<br/><pre>0x02090032</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid rights given for role &lt;placeholder&gt;(&lt;placeholder&gt;) : &lt;placeholder&gt; |
| api.security.controllers_definition_not_an_object<br/><pre>0x02090033</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The "controllers" definition must be an object |
| api.security.empty_controllers_definition<br/><pre>0x02090034</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The "controllers" definition cannot be empty |
| api.security.controller_definition_not_an_object<br/><pre>0x02090035</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;]: must be an object |
| api.security.empty_controller_definition<br/><pre>0x02090036</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;]: cannot be empty |
| api.security.actions_attribute_missing_in_controller_definition<br/><pre>0x02090037</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;]: "actions" attribute missing |
| api.security.actions_attribute_not_an_object_in_controller_definition<br/><pre>0x02090038</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;]: "actions" attribute must be an object |
| api.security.actions_attribute_empty_in_controller_definition<br/><pre>0x02090039</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;]: "actions" attribute cannot be empty |
| api.security.invalid_type_in_definition_for_controller_action<br/><pre>0x0209003a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;, &lt;placeholder&gt;]: must be a boolean or an object |
| api.security.missing_test_element_for_controller_action<br/><pre>0x0209003b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;, &lt;placeholder&gt;]. Permissions defined as closures must have a "test" element. |
| api.security.error_executing_function_for_controller_action<br/><pre>0x0209003c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid definition for [&lt;placeholder&gt;, &lt;placeholder&gt;]: error executing function |
| api.security.parsing_rights_for_role<br/><pre>0x0209003d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Error parsing rights for role &lt;placeholder&gt; (&lt;placeholder&gt;) : &lt;placeholder&gt; |
| api.security.parsing_closure_rights_for_role<br/><pre>0x0209003e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; |
| api.security.rights_action_closure_execution<br/><pre>0x0209003f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt; |

---


### Subdomain: 0x020a: memory_storage

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.memory_storage.match_parameter<br/><pre>0x020a0001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid match parameter. |
| api.memory_storage.limit_parameter<br/><pre>0x020a0002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid limit parameter. |
| api.memory_storage.add_empty_points_list<br/><pre>0x020a0003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Cannot add an empty points list. |
| api.memory_storage.points_parameter<br/><pre>0x020a0004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid points parameter. |
| api.memory_storage.entries_parameter<br/><pre>0x020a0005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid entries parameter. |
| api.memory_storage.aggregate_parameter<br/><pre>0x020a0006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid aggregate parameter. |
| api.memory_storage.float_expected<br/><pre>0x020a0007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid value for parameter &lt;placeholder&gt;: float expected. |
| api.memory_storage.integer_expected<br/><pre>0x020a0008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid value for parameter &lt;placeholder&gt;: integer expected. |
| api.memory_storage.no_source_key<br/><pre>0x020a0009</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | At least 1 source key must be provided. |
| api.memory_storage.no_score_member_pair<br/><pre>0x020a000a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | At least 1 score/member pair must be provided. |
| api.memory_storage.too_many_score_member_pairs<br/><pre>0x020a000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | No more than 1 score/member pair can be specified when the 'incr' option is set. |
| api.memory_storage.invalid_score_member_pair<br/><pre>0x020a000c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid score/member pair argument. |
| api.memory_storage.missing_argument<br/><pre>0x020a000d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Missing argument &lt;placeholder&gt;. |
| api.memory_storage.non_scalar_value<br/><pre>0x020a000e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Accepts only scalar values (number, string). |
| api.memory_storage.nx_xx_exclusive_opts<br/><pre>0x020a000f</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | NX and XX options are mutually exclusive. |
| api.memory_storage.ex_px_exclusive_opts<br/><pre>0x020a0010</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | EX and PX options are mutually exclusive. |
| api.memory_storage.direction_argument<br/><pre>0x020a0011</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid direction argument (expected: ASC or DESC). |

---


### Subdomain: 0x020b: request_assertions

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.request_assertions.must_specify_body<br/><pre>0x020b0001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify a body. |
| api.request_assertions.missing_body_attribute<br/><pre>0x020b0002</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify a body attribute "&lt;placeholder&gt;". |
| api.request_assertions.missing_attribute<br/><pre>0x020b0003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify an attribute "&lt;placeholder&gt;". |
| api.request_assertions.must_not_specify_body_attribute<br/><pre>0x020b0004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must not specify the body attribute "&lt;placeholder&gt;". |
| api.request_assertions.unexpected_type_assertion_on_attribute<br/><pre>0x020b0005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | An unexepected type assertion "&lt;placeholder&gt;" has been invoked on attribute "&lt;placeholder&gt;". |
| api.request_assertions.wrong_body_attribute_type<br/><pre>0x020b0006</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify the body attribute "&lt;placeholder&gt;" of type "&lt;placeholder&gt;". |
| api.request_assertions.missing_id<br/><pre>0x020b0007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify an _id. |
| api.request_assertions.wrong_id_format<br/><pre>0x020b0008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must not specify an _id that starts with an underscore (_). |
| api.request_assertions.missing_index<br/><pre>0x020b0009</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify an index. |
| api.request_assertions.missing_collection<br/><pre>0x020b000a</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify a collection. |
| api.request_assertions.missing_strategy<br/><pre>0x020b000b</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify a strategy. |
| api.request_assertions.wrong_strategy_type<br/><pre>0x020b000c</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request argument's strategy must be a string. |
| api.request_assertions.missing_scrollId<br/><pre>0x020b000d</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request must specify a scrollId. |
| api.request_assertions.wrong_scrollId_type<br/><pre>0x020b000e</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The request argument's scrollId must be a string. |
| api.request_assertions.must_be_authenticated_to_execute_action<br/><pre>0x020b000f</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | You must be authenticated to execute that action |
| api.request_assertions.unknown_strategy<br/><pre>0x020b0010</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | The strategy "&lt;placeholder&gt;" is not a known strategy. |
| api.request_assertions.must_be_an_object<br/><pre>0x020b0011</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Expected '&lt;placeholder&gt;' to be an object |

---

---

## 0x03: network



### Subdomain: 0x0301: http

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.http.http_request_error<br/><pre>0x03010001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt;. |
| network.http.http_request_size_exceeded<br/><pre>0x03010002</pre> | [SizeLimitError](/core/1/api/essentials/errors/handling#sizelimiterror) <pre>(413)</pre> | Maximum HTTP request size exceeded. |
| network.http.too_many_encodings<br/><pre>0x03010003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Too many encodings. |
| network.http.unsupported_compression_algorithm<br/><pre>0x03010004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unsupported compression algorithm "&lt;placeholder&gt;". |
| network.http.compression_support_disabled<br/><pre>0x03010005</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Compression support is disabled. |

---


### Subdomain: 0x0302: mqtt

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.mqtt.mqtt_request_error<br/><pre>0x03020001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt;. |

---


### Subdomain: 0x0303: websocket

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.websocket.websocket_request_error<br/><pre>0x03030001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | &lt;placeholder&gt;. |

---


### Subdomain: 0x0304: socketio

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |

---


### Subdomain: 0x0305: entrypoint

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.entrypoint.unknown_event_received<br/><pre>0x03050001</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unknown event received: &lt;placeholder&gt;. |
| network.entrypoint.invalid_network_port_number<br/><pre>0x03050002</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Invalid network port number: &lt;placeholder&gt;. |
| network.entrypoint.conflicting_protocol_name<br/><pre>0x03050003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Conflicting protocol name "&lt;placeholder&gt;". |

---


### Subdomain: 0x0306: http_router

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| network.http_router.unrecognized_http_method<br/><pre>0x03060001</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unrecognized HTTP method &lt;placeholder&gt;. |
| network.http_router.api_url_not_found<br/><pre>0x03060002</pre> | [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror) <pre>(404)</pre> | API URL not found: &lt;placeholder&gt;. |
| network.http_router.invalid_request_content_type<br/><pre>0x03060003</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid request content-type. Expected "application/json", got: "&lt;placeholder&gt;". |
| network.http_router.invalid_request_charset<br/><pre>0x03060004</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Invalid request charset. Expected "utf-8", got: "&lt;placeholder&gt;". |
| network.http_router.unable_to_attach_url<br/><pre>0x03060005</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | Unable to attach URL &lt;placeholder&gt;: URL path already exists. |
| network.http_router.part_already_exists<br/><pre>0x03060006</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | part already exists. |
| network.http_router.unable_to_convert_http_header_to_json<br/><pre>0x03060007</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unable to convert HTTP x-kuzzle-volatile header to JSON. |
| network.http_router.unable_to_convert_http_body_to_json<br/><pre>0x03060008</pre> | [BadRequestError](/core/1/api/essentials/errors/handling#badrequesterror) <pre>(400)</pre> | Unable to convert HTTP body to JSON. |
| network.http_router.request_error<br/><pre>0x03060009</pre> | [InternalError](/core/1/api/essentials/errors/handling#internalerror) <pre>(500)</pre> | &lt;placeholder&gt;. |

---

---

## 0x04: plugins



### Subdomain: 0x0401: validation

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugins.validation.invalid_plugin_name<br/><pre>0x04010001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Invalid plugin name. The name must be comprised only of letters, numbers, hyphens and underscores. |
| plugins.validation.invalid_privileged_property<br/><pre>0x04010002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Invalid "privileged" property: expected a boolean, got a &lt;placeholder&gt;. |
| plugins.validation.missing_package_json<br/><pre>0x04010003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No package.json file found. |
| plugins.validation.invalid_user_object<br/><pre>0x04010004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | You must provide a valid User object when adding context with as(). |
| plugins.validation.missing_name_property_in_package_json<br/><pre>0x04010005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No "name" property provided in package.json. |
| plugins.validation.collection_not_specified<br/><pre>0x04010006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The collection must be specified. |
| plugins.validation.callback_argument_expected<br/><pre>0x04010007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: Expected callback to be a function, received "&lt;placeholder&gt;". |
| plugins.validation.missing_request_object<br/><pre>0x04010008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: a Request object must be supplied. |
| plugins.validation.invalid_custom_event_name<br/><pre>0x04010009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Custom event invalid name (&lt;placeholder&gt;). Colons are not allowed in custom events. |
| plugins.validation.missing_request_data_or_object<br/><pre>0x0401000a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A Request object and/or request data must be provided. |
| plugins.validation.invalid_strategy_registration<br/><pre>0x0401000b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Strategy &lt;placeholder&gt;: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk). |
| plugins.validation.strategy_description_type<br/><pre>0x0401000c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the strategy description to be an object, got: &lt;placeholder&gt;. |
| plugins.validation.methods_property_type<br/><pre>0x0401000d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "methods" property of type "object", got: &lt;placeholder&gt;. |
| plugins.validation.methodname_property_type<br/><pre>0x0401000e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "&lt;placeholder&gt;" property of type "string", got: &lt;placeholder&gt;. |
| plugins.validation.invalid_strategy_method<br/><pre>0x0401000f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the strategy method "&lt;placeholder&gt;" must point to an exposed function. |
| plugins.validation.invalid_property_type<br/><pre>0x04010010</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "&lt;placeholder&gt;" property to be of type "string", got: &lt;placeholder&gt;. |
| plugins.validation.missing_config_property<br/><pre>0x04010012</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected a "config" property of type "object", got: &lt;placeholder&gt;. |
| plugins.validation.cannot_set_ctor_and_authenticator<br/><pre>0x04010013</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the "authenticator" and "constructor" parameters cannot both be set. |
| plugins.validation.invalid_constructor_property_value<br/><pre>0x04010014</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid "constructor" property value: constructor expected. |
| plugins.validation.authenticator_property_type<br/><pre>0x04010015</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected an "authenticator" property of type "string", got: &lt;placeholder&gt;. |
| plugins.validation.unknown_authenticator_value<br/><pre>0x04010016</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; unknown authenticator value: &lt;placeholder&gt;. |
| plugins.validation.expected_object_type<br/><pre>0x04010017</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "&lt;placeholder&gt;" property to be of type "object", got: &lt;placeholder&gt;. |
| plugins.validation.invalid_fields_property_type<br/><pre>0x04010018</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "fields" property to be of type "array", got: &lt;placeholder&gt;. |
| plugins.validation.key_cannot_be_empty_string<br/><pre>0x04010019</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; "&lt;placeholder&gt;" must be a non-empty string. |
| plugins.validation.incorrect_controller_description_type<br/><pre>0x0401001a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Incorrect controller description type (expected object, got: "&lt;placeholder&gt;"). |
| plugins.validation.unknown_property_key_in_route_definition<br/><pre>0x0401001b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Unknown property "&lt;placeholder&gt;" in route definition. &lt;placeholder&gt; |
| plugins.validation.strategies_plugin_property_empty<br/><pre>0x0401001c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the exposed "strategies" plugin property must be a non-empty object. |
| plugins.validation.authenticators_plugin_property_not_an_object<br/><pre>0x0401001d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; the exposed "authenticators" plugin property must be of type "object". |
| plugins.validation.invalid_authenticator<br/><pre>0x0401001e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authenticator &lt;placeholder&gt;: expected a constructor. |
| plugins.validation.http_verb_not_allowed<br/><pre>0x0401001f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; Only following http verbs are allowed: "&lt;placeholder&gt;". &lt;placeholder&gt; |
| plugins.validation.invalid_name_property<br/><pre>0x04010020</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;/manifest.json] Invalid "name" property: expected a non-empty string. |
| plugins.validation.missing_name_property<br/><pre>0x04010021</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;/manifest.json] A "name" property is required. |
| plugins.validation.function_validate_not_implemented<br/><pre>0x04010022</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The type &lt;placeholder&gt; must implement the function 'validate'. |
| plugins.validation.function_validateFieldSpecification_not_implemented<br/><pre>0x04010023</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The type &lt;placeholder&gt; must implement the function 'validateFieldSpecification'. |
| plugins.validation.function_getStrictness_not_implemented<br/><pre>0x04010024</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The allowing children type &lt;placeholder&gt; must implement the function 'getStrictness'. |
| plugins.validation.unable_to_load_manifest<br/><pre>0x04010025</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] Unable to load the file 'manifest.json'. |
| plugins.validation.version_mismatch<br/><pre>0x04010026</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;/manifest.json] Version mismatch: current Kuzzle version &lt;placeholder&gt; does not match the manifest requirements (&lt;placeholder&gt;). |

---


### Subdomain: 0x0402: runtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugins.runtime.cannot_use_realtime_method<br/><pre>0x04020001</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | "realtime:&lt;placeholder&gt;" method is not available in plugins. You should use plugin hooks instead. |
| plugins.runtime.plugin_initialization_failed<br/><pre>0x04020002</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Something went wrong during initialization of "&lt;placeholder&gt;" plugin. |
| plugins.runtime.plugin_threw_non_kuzzle_error<br/><pre>0x04020003</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Plugin &lt;placeholder&gt; pipe for event '&lt;placeholder&gt;' threw a non-Kuzzle error: &lt;placeholder&gt;. |
| plugins.runtime.verify_dont_return_promise<br/><pre>0x04020004</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; expected the "verify" to return a Promise, got: &lt;placeholder&gt;. |
| plugins.runtime.invalid_authentication_strategy_result<br/><pre>0x04020005</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authentication strategy result. |
| plugins.runtime.invalid_authentication_kuid<br/><pre>0x04020006</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; invalid authentication kuid returned: expected a string, got a &lt;placeholder&gt;. |
| plugins.runtime.unknown_kuzzle_user_identifier<br/><pre>0x04020007</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; returned an unknown Kuzzle user identifier. |
| plugins.runtime.cannot_remove_others_plugin_strategy<br/><pre>0x04020008</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Cannot remove strategy &lt;placeholder&gt;: owned by another plugin. |
| plugins.runtime.cannot_remove_unexistant_strategy<br/><pre>0x04020009</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Cannot remove strategy &lt;placeholder&gt;: strategy does not exist. |
| plugins.runtime.undefined_controller<br/><pre>0x0402000a</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Undefined controller "&lt;placeholder&gt;". &lt;placeholder&gt; |
| plugins.runtime.undefined_action<br/><pre>0x0402000b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Undefined action "&lt;placeholder&gt;". &lt;placeholder&gt; |
| plugins.runtime.unable_to_load_plugin_from_directory<br/><pre>0x0402000c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load plugins from directory "&lt;placeholder&gt;"; &lt;placeholder&gt;. |
| plugins.runtime.unable_to_load_plugin_from_path<br/><pre>0x0402000d</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load plugin from path "&lt;placeholder&gt;"; &lt;placeholder&gt;. |
| plugins.runtime.init_method_not_found<br/><pre>0x0402000e</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] No "init" method found. |
| plugins.runtime.privileged_mode_not_supported<br/><pre>0x0402000f</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin "&lt;placeholder&gt;" is configured to run in privileged mode, but it does not seem to support it. |
| plugins.runtime.privileged_mode_not_setted<br/><pre>0x04020010</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | The plugin "&lt;placeholder&gt;" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration. |
| plugins.runtime.name_already_exists<br/><pre>0x04020011</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | A plugin named &lt;placeholder&gt; already exists |
| plugins.runtime.not_a_constructor<br/><pre>0x04020012</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Plugin &lt;placeholder&gt; is not a constructor. |
| plugins.runtime.plugin_error<br/><pre>0x04020013</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | &lt;placeholder&gt; |
| plugins.runtime.missing_user<br/><pre>0x04020014</pre> | [UnauthorizedError](/core/1/api/essentials/errors/handling#unauthorizederror) <pre>(401)</pre> | &lt;placeholder&gt; |
| plugins.runtime.register_pipe_timeout<br/><pre>0x04020015</pre> | [GatewayTimeoutError](/core/1/api/essentials/errors/handling#gatewaytimeouterror) <pre>(504)</pre> | &lt;placeholder&gt; |
| plugins.runtime.unable_to_serialize_response<br/><pre>0x04020016</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to serialize response. Are you trying to return the request? |
| plugins.runtime.user_creation<br/><pre>0x04020017</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | An error occurred during the creation of user "&lt;placeholder&gt;":
&lt;placeholder&gt; |
| plugins.runtime.unexpected_return_value<br/><pre>0x04020018</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unexpected return value from action "&lt;placeholder&gt;:&lt;placeholder&gt;": expected a Promise |
| plugins.runtime.invalid_connection<br/><pre>0x04020019</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Invalid connection: &lt;placeholder&gt; |
| plugins.runtime.unknown_connection<br/><pre>0x0402001b</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | Unable to remove connection - unknown connection identifier: &lt;placeholder&gt; |
| plugins.runtime.errors_configuration_file<br/><pre>0x0402001c</pre> | [PluginImplementationError](/core/1/api/essentials/errors/handling#pluginimplementationerror) <pre>(500)</pre> | [&lt;placeholder&gt;] errors field in manifest.json badly formatted: &lt;placeholder&gt; |

---

---
