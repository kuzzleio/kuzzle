---
code: false
type: page
title: Error Subcodes
description: error subcodes definitions
order: 500
---

# Error subcodes definitions

## internal, code: 0



### Subdomain: unexpected, code: 0

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
001  | `Unknown error: <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | unknown_error | internal.unexpected.unknown_error

---


### Subdomain: external_services, code: 1

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
011  | `Service unavailable: <placeholder>.` | [ServiceUnavailableError](https://docs.kuzzle.io/core/1/api/essentials/errors/#serviceunavailableerror) | service_unavailable | internal.external_services.service_unavailable

---


### Subdomain: hotelclerk, code: 2

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
021  | `The room Id "<placeholder>" does not exist.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | room_id_not_exists | internal.hotelclerk.room_id_not_exists
022  | `No subscription found on index <placeholder> and collection <placeholder>.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | subscription_not_found | internal.hotelclerk.subscription_not_found
023  | `The rooms attribute must be an array.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | rooms_attribute_type | internal.hotelclerk.rooms_attribute_type
024  | `Incorrect value for the 'state' parameter. Expected: all, done or pending. Got: <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | incorrect_state_value | internal.hotelclerk.incorrect_state_value
025  | `Incorrect value for the 'scope' parameter. Expected: all, done or pending. Got: <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | incorrect_scope_value | internal.hotelclerk.incorrect_scope_value
026  | `Incorrect value for the 'users' parameter. Expected: all, done or pending. Got: <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | incorrect_users_value | internal.hotelclerk.incorrect_users_value
027  | `Cannot subscribe without an index and a collection.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_subscription_parameter | internal.hotelclerk.missing_subscription_parameter
028  | `Unable to subscribe: maximum number of minterms exceeded (max <placeholder>, received <placeholder>).` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | limit_minterms_reached | internal.hotelclerk.limit_minterms_reached
029  | `Unable to subscribe: maximum number of unique rooms reached.` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | limit_unique_rooms_reached | internal.hotelclerk.limit_unique_rooms_reached
0210  | `Unsubscribe error: no subscription found for that user.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | cant_unsubscribe_unknown_user | internal.hotelclerk.cant_unsubscribe_unknown_user
0211  | `Unsubscribe error: not subscribed to <placeholder>.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | cant_unsubscribe_user_not_subscribed | internal.hotelclerk.cant_unsubscribe_user_not_subscribed
0212  | `Unsubscribe error: room <placeholder> not found.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | cant_unsubscribe_unknown_room | internal.hotelclerk.cant_unsubscribe_unknown_room

---


### Subdomain: janitor, code: 3

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
031  | `Some data was not imported for <placeholder>/<placeholder> (<placeholder>/<placeholder>).` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | import_data | internal.janitor.import_data
032  | `A dump is already being generated. Skipping.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | dump_already_generated | internal.janitor.dump_already_generated
033  | `Cannot read log directory '<placeholder>' : <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | reading_log_directory | internal.janitor.reading_log_directory

---


### Subdomain: vault, code: 4

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
041  | `Cannot decrypt secrets: <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | decrypt_secrets | internal.vault.decrypt_secrets
042  | `Cannot find vault key. Aborting.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | vault_key_not_found | internal.vault.vault_key_not_found

---


### Subdomain: plugins, code: 5

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
051  | `[<placeholder>] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_plugin_name | internal.plugins.invalid_plugin_name
052  | `[<placeholder>] Invalid "privileged" property: expected a boolean, got a <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_privileged_property | internal.plugins.invalid_privileged_property
053  | `[<placeholder>] No package.json file found.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_package_json | internal.plugins.missing_package_json
054  | `[<placeholder>] No "name" property provided in package.json.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_name_property_in_package_json | internal.plugins.missing_name_property_in_package_json
055  | `You must provide a valid User object when adding context with as().` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_user_object | internal.plugins.invalid_user_object
056  | `The collection must be specified.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | collection_not_specified | internal.plugins.collection_not_specified
057  | `Invalid argument: Expected callback to be a function, received "<placeholder>".` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | callback_argument_expected | internal.plugins.callback_argument_expected
058  | `Invalid argument: a Request object must be supplied.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_request_object | internal.plugins.missing_request_object
059  | `Custom event invalid name (<placeholder>). Colons are not allowed in custom events.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_custom_event_name | internal.plugins.invalid_custom_event_name
0510  | `A Request object and/or request data must be provided.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_request_data_or_object | internal.plugins.missing_request_data_or_object
0511  | `[<placeholder>] Strategy <placeholder>: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk).` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_strategy_registration | internal.plugins.invalid_strategy_registration
0512  | `Something went wrong during initialization of "<placeholder>" plugin.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_initialization_failed | internal.plugins.plugin_initialization_failed
0513  | `<placeholder> expected the strategy description to be an object, got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | strategy_description_type | internal.plugins.strategy_description_type
0514  | `<placeholder> expected a "methods" property of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | methods_property_type | internal.plugins.methods_property_type
0515  | `<placeholder> expected a "<placeholder>" property of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | methodname_property_type | internal.plugins.methodname_property_type
0516  | `<placeholder> the strategy method "<placeholder>" must point to an exposed function.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_strategy_method | internal.plugins.invalid_strategy_method
0517  | `<placeholder> expected the "<placeholder>" property to be of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_property_type | internal.plugins.invalid_property_type
0518  | `<placeholder> expected a "config" property of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_config_property | internal.plugins.missing_config_property
0519  | `<placeholder> the "authenticator" and "constructor" parameters cannot both be set.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_set_ctor_and_authenticator | internal.plugins.cannot_set_ctor_and_authenticator
0520  | `<placeholder> invalid "constructor" property value: constructor expected.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_constructor_property_value | internal.plugins.invalid_constructor_property_value
0521  | `<placeholder> expected an "authenticator" property of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | authenticator_property_type | internal.plugins.authenticator_property_type
0522  | `<placeholder> unknown authenticator value: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unknown_authenticator_value | internal.plugins.unknown_authenticator_value
0523  | `<placeholder> expected the "<placeholder>" property to be of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | expected_object_type | internal.plugins.expected_object_type
0524  | `<placeholder> expected the "fields" property to be of type "array", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_fields_property_type | internal.plugins.invalid_fields_property_type
0525  | `Plugin <placeholder> pipe for event '<placeholder>' threw a non-Kuzzle error: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_threw_non_kuzzle_error | internal.plugins.plugin_threw_non_kuzzle_error
0526  | `<placeholder> expected the "verify" to return a Promise, got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | verify_dont_return_promise | internal.plugins.verify_dont_return_promise
0527  | `<placeholder> invalid authentication strategy result.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authentication_strategy_result | internal.plugins.invalid_authentication_strategy_result
0528  | `<placeholder> invalid authentication kuid returned: expected a string, got a <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authentication_kuid | internal.plugins.invalid_authentication_kuid
0529  | `<placeholder> returned an unknown Kuzzle user identifier.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unkown_kuzzle_user_identifier | internal.plugins.unkown_kuzzle_user_identifier
0530  | `Cannot remove strategy <placeholder>: owned by another plugin.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_remove_others_plugin_strategy | internal.plugins.cannot_remove_others_plugin_strategy
0531  | `Cannot remove strategy <placeholder>: strategy does not exist.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_remove_unexistant_strategy | internal.plugins.cannot_remove_unexistant_strategy
0532  | `<placeholder> Incorrect controller description type (expected object, got: "<placeholder>").` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | incorrect_controller_description_type | internal.plugins.incorrect_controller_description_type
0533  | `<placeholder> Unknown property "<placeholder>" in route definition. <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unknown_property_key_in_route_definition | internal.plugins.unknown_property_key_in_route_definition
0534  | `<placeholder> "<placeholder>" must be a non-empty string.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | key_cannot_be_empty_string | internal.plugins.key_cannot_be_empty_string
0535  | `Undefined controller "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | undefined_controller | internal.plugins.undefined_controller
0536  | `Undefined action "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | undefined_action | internal.plugins.undefined_action
0537  | `<placeholder> Only following http verbs are allowed: "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | http_verb_not_allowed | internal.plugins.http_verb_not_allowed
0538  | `<placeholder> the exposed "strategies" plugin property must be a non-empty object.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | strategies_plugin_property_empty | internal.plugins.strategies_plugin_property_empty
0539  | `<placeholder> the exposed "authenticators" plugin property must be of type "object".` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | authenticators_plugin_property_not_an_object | internal.plugins.authenticators_plugin_property_not_an_object
0540  | `<placeholder> invalid authenticator <placeholder>: expected a constructor.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authenticator | internal.plugins.invalid_authenticator
0541  | `Unable to load plugins from directory "<placeholder>"; <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_load_plugin_from_directory | internal.plugins.unable_to_load_plugin_from_directory
0542  | `Unable to load plugin from path "<placeholder>"; <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_load_plugin_from_path | internal.plugins.unable_to_load_plugin_from_path
0543  | `Plugin <placeholder> is not a constructor.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_is_not_a_constructor | internal.plugins.plugin_is_not_a_constructor
0544  | `[<placeholder>] No "init" method found.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | init_method_not_found | internal.plugins.init_method_not_found
0545  | `The plugin "<placeholder>" is configured to run in privileged mode, but it does not seem to support it.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | privileged_mode_not_supported | internal.plugins.privileged_mode_not_supported
0546  | `The plugin "<placeholder>" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | privileged_mode_not_setted | internal.plugins.privileged_mode_not_setted
0547  | `A plugin named <placeholder> already exists` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_name_already_exists | internal.plugins.plugin_name_already_exists
0548  | `FunnelProtocol.constructor: Invalid User object "<placeholder>"` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | invalid_user_object_provided | internal.plugins.invalid_user_object_provided

---


### Subdomain: validation, code: 6

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
061  | `The typeName property must be defined in the validation type object.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_typename_property | internal.validation.missing_typename_property
062  | `The type <placeholder> must implement the function 'validate'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_function_validate | internal.validation.missing_function_validate
063  | `The type <placeholder> must implement the function 'validateFieldSpecification'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_function_validatefieldspecification | internal.validation.missing_function_validatefieldspecification
064  | `The allowing children type <placeholder> must implement the function 'getStrictness'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_function_getstrictness | internal.validation.missing_function_getstrictness
065  | `The type <placeholder> is already defined.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | type_already_defined | internal.validation.type_already_defined
066  | `All levels of an object have to be defined in the specification.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | object_format_error | internal.validation.object_format_error
067  | `The field type <placeholder> is not allowed to have children fields.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | type_not_allowed | internal.validation.type_not_allowed
068  | `The parent field of the field "<placeholder>" is not defined.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | parent_field_not_defined | internal.validation.parent_field_not_defined
069  | `Document: <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | errorcontext_document | internal.validation.errorcontext_document
0610  | `Invalid "formats" option: must be a non-empty array.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_formats_option | internal.validation.invalid_formats_option
0611  | `Unrecognized format name<placeholder>: <placeholder>.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | unrecognized_format_name | internal.validation.unrecognized_format_name
0612  | `Invalid "range" option definition.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_range_option | internal.validation.invalid_range_option
0613  | `Invalid range: min > max.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_range | internal.validation.invalid_range
0614  | `Invalid "range.<placeholder>" option: must be of type "number".` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_range_type | internal.validation.invalid_range_type
0615  | `Option "<placeholder>": invalid format.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_range_format | internal.validation.invalid_range_format
0616  | `Unable to parse the range value "<placeholder>".` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | unable_to_parse_range_value | internal.validation.unable_to_parse_range_value
0617  | `Option "notEmpty" must be of type "boolean".` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | notempty_option_type | internal.validation.notempty_option_type
0618  | `Option "values" is required.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | missing_values_option | internal.validation.missing_values_option
0619  | `Option "values" must be a non-empty array.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | values_option_cannot_be_empty | internal.validation.values_option_cannot_be_empty
0620  | `Values must be of type "string". Invalid value<placeholder>: <placeholder>.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_values_format | internal.validation.invalid_values_format
0621  | `Option "shapeTypes" must be a non-empty array.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | shapetypes_option_cannot_be_empty | internal.validation.shapetypes_option_cannot_be_empty
0622  | `Invalid shape<placeholder>: <placeholder>.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_shape | internal.validation.invalid_shape
0623  | `Option "strict" must be of type "boolean".` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | strict_option_type | internal.validation.strict_option_type
0624  | `Invalid "length" option definition.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_length_option | internal.validation.invalid_length_option
0625  | `Invalid "length.<placeholder>" option: must be of type "number".` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_length_type | internal.validation.invalid_length_type
0626  | `Invalid length range: min > max.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_length_range | internal.validation.invalid_length_range
0627  | `<placeholder>` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | invalid_properties_for_collection_specification | internal.validation.invalid_properties_for_collection_specification
0628  | `<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | structure_collection_validation | internal.validation.structure_collection_validation
0629  | `Validator specification of the collection <placeholder>.<placeholder> triggered an error` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | validator_specification_of_collection_error | internal.validation.validator_specification_of_collection_error
0630  | `All levels of an object have to be defined in the specification.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | object_level_undefined_in_specification | internal.validation.object_level_undefined_in_specification
0631  | `<placeholder>` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | throw_error | internal.validation.throw_error
0632  | `Field <placeholder>: <placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | manage_error_message | internal.validation.manage_error_message
0633  | `strictness` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | strictness | internal.validation.strictness
0634  | `Field <placeholder>: <placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | errorcontext | internal.validation.errorcontext

---


### Subdomain: statistics, code: 7

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
071  | `Invalid time value` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_time_value | internal.statistics.invalid_time_value

---


### Subdomain: sandbox, code: 8

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
081  | `A process is already running for this sandbox` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | process_already_running | internal.sandbox.process_already_running
082  | `Timeout. The sandbox did not respond within <placeholder>ms.` | [GatewayTimeoutError](https://docs.kuzzle.io/core/1/api/essentials/errors/#gatewaytimeouterror) | timeout | internal.sandbox.timeout

---

---

## external, code: 1



### Subdomain: elasticsearch, code: 1

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
111  | `Your elasticsearch version is <placeholder>; Only elasticsearch version 5 is currently supported.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | wrong_elasticsearch_version | external.elasticsearch.wrong_elasticsearch_version
112  | `Non-existing or expired scroll identifier.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | unknown_scroll_identifier | external.elasticsearch.unknown_scroll_identifier
113  | `The action _search can't be done with a GET.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | wrong_get_action | external.elasticsearch.wrong_get_action
114  | `Document not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | document_not_found | external.elasticsearch.document_not_found
115  | `Index '<placeholder>' and/or collection '<placeholder>' don't exist.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | index_or_collection_does_not_exist | external.elasticsearch.index_or_collection_does_not_exist
116  | `Document already exists.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | document_already_exists | external.elasticsearch.document_already_exists
117  | `Document with id '<placeholder>' not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | document_id_not_found | external.elasticsearch.document_id_not_found
118  | `Query cannot be empty.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | empty_query | external.elasticsearch.empty_query
119  | `null is not a valid document ID.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | document_id_cannot_be_null | external.elasticsearch.document_id_cannot_be_null
1110  | `Index '<placeholder>' does not exist.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | index_does_not_exist | external.elasticsearch.index_does_not_exist
1111  | `import must specify a body attribute 'bulkData' of type Object.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_or_invalid_import_attribute | external.elasticsearch.missing_or_invalid_import_attribute
1112  | `Missing data collection argument.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_data_collection_argument | external.elasticsearch.missing_data_collection_argument
1113  | `Missing data index argument.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_data_index_argument | external.elasticsearch.missing_data_index_argument
1114  | `Index '<placeholder>' is protected, please use appropriated routes instead.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | index_protected | external.elasticsearch.index_protected
1115  | `Error refreshing index <placeholder>:
<placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | error_on_index_refresh | external.elasticsearch.error_on_index_refresh
1116  | `Number of documents exceeds the server configured value (<placeholder>).` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | limit_documents_reached | external.elasticsearch.limit_documents_reached
1117  | `Indexes starting with a '%' are reserved for internal use. Cannot process index <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | index_reserved | external.elasticsearch.index_reserved
1118  | `Kuzzle does not support '_routing' in create action.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | create_action_does_not_support_routing | external.elasticsearch.create_action_does_not_support_routing
1119  | `Refresh parameter only supports the value 'wait_for' or false.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | wrong_refresh_parameter | external.elasticsearch.wrong_refresh_parameter
1120  | `Incorrect mapping property "mapping.<placeholder>".<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | incorrect_mapping_property | external.elasticsearch.incorrect_mapping_property
1121  | `"<placeholder>" threads buffer exceeded. Too many operations received at once.` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | too_many_operations | external.elasticsearch.too_many_operations
1122  | `Can not change mapping for field "<placeholder>" from nested to another type.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_change_from_nested | external.elasticsearch.invalid_change_from_nested
1123  | `Can not change mapping for field "<placeholder>" from object to another type.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_change_to_nested | external.elasticsearch.invalid_change_to_nested
1124  | `Can not change mapping for field "<placeholder>" from object to a scalar type.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_change_to_scalar | external.elasticsearch.invalid_change_to_scalar
1125  | `Can not set mapping for field "<placeholder>" on collection "<placeholder>" because the field name is already used in another collection with a different type.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | duplicate_field_name | external.elasticsearch.duplicate_field_name
1126  | `Can not change type of field "<placeholder>" from "<placeholder>" to "<placeholder>".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_type_change | external.elasticsearch.invalid_type_change
1127  | `Parameter "<placeholder>" is not supported for field "<placeholder>".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unsupported_parameter_for_field | external.elasticsearch.unsupported_parameter_for_field
1128  | `Can not set mapping for field "<placeholder>" because type "<placeholder>" does not exist` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | type_does_not_exist | external.elasticsearch.type_does_not_exist
1129  | `Failed to validate value of field "<placeholder>". Are you trying to insert nested value in a non-nested field ?` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | fail_to_parse_field | external.elasticsearch.fail_to_parse_field
1130  | `Mapping for field "<placeholder>" must be an object with a property "type".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | wrong_mapping_property | external.elasticsearch.wrong_mapping_property
1131  | `Unable to modify document "<placeholder>": cluster sync failed (too many simultaneous changes applied)` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | too_many_changes | external.elasticsearch.too_many_changes
1132  | `Elasticsearch service is not connected.` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | elasticsearch_service_not_connected | external.elasticsearch.elasticsearch_service_not_connected
1133  | `<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unexpected_bad_request_error | external.elasticsearch.unexpected_bad_request_error
1134  | `<placeholder>` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | unexpected_not_found_error | external.elasticsearch.unexpected_not_found_error
1135  | `<placeholder>` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | unexpected_conflict_error | external.elasticsearch.unexpected_conflict_error
1136  | `<placeholder>` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | unexpected_error | external.elasticsearch.unexpected_error
1137  | `No mapping found for index "<placeholder>".` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | no_mapping_found | external.elasticsearch.no_mapping_found
1138  | `Index or collection "<placeholder>" does not exist, please create it first.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | index_or_collection_not_found | external.elasticsearch.index_or_collection_not_found

---


### Subdomain: internal_engine, code: 2

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
121  | `Internal engine bootstrap - lock wait timeout exceeded.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | lock_wait_timeout | external.internal_engine.lock_wait_timeout
122  | `Plugin <placeholder> bootstrap - lock wait timeout exceeded.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | plugin_bootstrap_lock_wait_timeout | external.internal_engine.plugin_bootstrap_lock_wait_timeout

---


### Subdomain: redis, code: 3

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
131  | `Redis service is not connected.` | [ServiceUnavailableError](https://docs.kuzzle.io/core/1/api/essentials/errors/#serviceunavailableerror) | redis_service_not_connected | external.redis.redis_service_not_connected

---

---

## api, code: 2



### Subdomain: base, code: 1

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
211  | `Invalid '<placeholder>' value (<placeholder>).` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_value_type | api.base.invalid_value_type

---


### Subdomain: server, code: 2

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
221  | `ElasticSearch is down: <placeholder>.` | [ExternalServiceError](https://docs.kuzzle.io/core/1/api/essentials/errors/#externalserviceerror) | elasticsearch_down | api.server.elasticsearch_down
222  | `Error : <placeholder>.` | [ServiceUnavailableError](https://docs.kuzzle.io/core/1/api/essentials/errors/#serviceunavailableerror) | service_unavailable | api.server.service_unavailable

---


### Subdomain: document, code: 3

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
231  | `The document does not exist: <placeholder>.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | not_found | api.document.not_found
232  | `Search on multiple indexes is not available.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | search_on_multiple_indexes | api.document.search_on_multiple_indexes
233  | `Search on multiple collections is not available.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | search_on_multiple_collections | api.document.search_on_multiple_collections
234  | `Missing 'scrollId' argument.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_scroll_id | api.document.missing_scroll_id
235  | `Number of gets to perform exceeds the server configured value ( <placeholder> ).` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | get_limit_reached | api.document.get_limit_reached
236  | `Some document creations failed : <placeholder>.` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | creation_failed | api.document.creation_failed
237  | `Some document deletions failed : <placeholder>.` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | deletion_failed | api.document.deletion_failed

---


### Subdomain: admin, code: 4

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
241  | `Database <placeholder> not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | database_not_found | api.admin.database_not_found
242  | `Lock action error: <placeholder>.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | action_locked | api.admin.action_locked

---


### Subdomain: auth, code: 5

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
251  | `Error while forcing token expiration.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | token_force_expire | api.auth.token_force_expire
252  | `Invalid token.` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | invalid_token | api.auth.invalid_token
253  | `Unknown authentication strategy "<placeholder>"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unknown_authentication_strategy | api.auth.unknown_authentication_strategy
254  | `Unknown User : cannot generate token` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | cannot_generate_token_with_unknown_user | api.auth.cannot_generate_token_with_unknown_user
255  | `Unknown context : cannot generate token` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | cannot_generate_token_with_unknown_context | api.auth.cannot_generate_token_with_unknown_context
256  | `expiresIn value exceeds maximum allowed value` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | expiresIn_limit_reached | api.auth.expiresIn_limit_reached
257  | `Error while generating token` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | generate_token_error | api.auth.generate_token_error
258  | `Token expired` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | token_expired | api.auth.token_expired
259  | `Json Web Token Error` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | json_web_token_error | api.auth.json_web_token_error
2510  | `Error verifying token` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | error_verifying_token | api.auth.error_verifying_token

---


### Subdomain: collection, code: 6

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
261  | `The index <placeholder> does not exist.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | index_does_not_exist | api.collection.index_does_not_exist
262  | `The collection <placeholder> does not exist.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | collection_does_not_exist | api.collection.collection_does_not_exist
263  | `Search page size exceeds server configured documents limit ( <placeholder> ).` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | search_page_size | api.collection.search_page_size
264  | `Must specify a valid type argument; Expected: 'all', 'stored' or 'realtime'; Received: <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_type_argument | api.collection.invalid_type_argument
265  | `<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | update_specifications | api.collection.update_specifications

---


### Subdomain: funnel, code: 7

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
271  | `Request discarded: Kuzzle Server is temporarily overloaded.` | [ServiceUnavailableError](https://docs.kuzzle.io/core/1/api/essentials/errors/#serviceunavailableerror) | server_overloaded | api.funnel.server_overloaded
272  | `Unauthorized action [ <placeholder> / <placeholder> / <placeholder> / <placeholder> ] for anonymous user.` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | anonymous_user_permissions | api.funnel.anonymous_user_permissions
273  | `Forbidden action [ <placeholder> / <placeholder> / <placeholder> / <placeholder> ] for user <placeholder>.` | [ForbiddenError](https://docs.kuzzle.io/core/1/api/essentials/errors/#forbiddenerror) | insufficient_permissions | api.funnel.insufficient_permissions
274  | `Unknown controller <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unknown_controller | api.funnel.unknown_controller
275  | `No corresponding action <placeholder> in controller <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unknown_action | api.funnel.unknown_action
276  | `Unauthorized action <placeholder> for anonymous user.` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | unauthorized_action | api.funnel.unauthorized_action
277  | `Forbidden action <placeholder> for user <placeholder>.` | [ForbiddenError](https://docs.kuzzle.io/core/1/api/essentials/errors/#forbiddenerror) | forbidden_action | api.funnel.forbidden_action
278  | `Client connection dropped` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | client_connection_dropped | api.funnel.client_connection_dropped

---


### Subdomain: bulk, code: 8

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
281  | `Some document creations failed: <placeholder>.` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | document_creations_failed | api.bulk.document_creations_failed
282  | `Some data was not imported: <placeholder>.` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | data_not_imported | api.bulk.data_not_imported

---


### Subdomain: security, code: 9

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
291  | `Role with id <placeholder> not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | role_not_found | api.security.role_not_found
292  | `Profile with id <placeholder> not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | profile_not_found | api.security.profile_not_found
293  | `User with id <placeholder> not found.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | user_not_found | api.security.user_not_found
294  | `Admin user is already set.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | admin_exists | api.security.admin_exists
295  | `Cannot create credentials: unknown kuid <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cant_create_creds | api.security.cant_create_creds
296  | `Cannot update credentials: unknown kuid <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cant_update_creds | api.security.cant_update_creds
297  | `The number of deletes to perform exceeds the server configured value <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | delete_limit_reached | api.security.delete_limit_reached
298  | `security:mDelete <placeholder> Error(s) deleting <placeholder> items, <placeholder>.` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | mdelete | api.security.mdelete
299  | `Search page size exceeds server configured documents limit <placeholder>.` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | search_page_size_limit_reached | api.security.search_page_size_limit_reached
2910  | `Cannot update non-existing <placeholder> <placeholder>.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | cant_update_non_existing | api.security.cant_update_non_existing
2911  | `User <placeholder> already exists.` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | user_already_exists | api.security.user_already_exists
2912  | `Strategy <placeholder> is not a known strategy.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unknown_strategy | api.security.unknown_strategy
2913  | `Internal database inconsistency detected: existing credentials found on non-existing user <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | creds_on_non_existing_user | api.security.creds_on_non_existing_user
2914  | `<placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | validate_method | api.security.validate_method
2915  | `Missing profileId` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_profile_id | api.security.missing_profile_id
2916  | `Missing profileIds` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_profile_ids | api.security.missing_profile_ids
2917  | `An array of strings must be provided as profileIds` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | profile_ids_must_be_array_of_string | api.security.profile_ids_must_be_array_of_string
2918  | `Invalid argument: Expected profile id to be a string, received "<placeholder>"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | expected_profile_id_to_be_a_string | api.security.expected_profile_id_to_be_a_string
2919  | `<placeholder> is one of the basic profiles of Kuzzle, you cannot delete it, but you can edit it.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cannot_delete_basic_profile | api.security.cannot_delete_basic_profile
2920  | `The profile "<placeholder>" cannot be deleted since it is used by some users.` | [ForbiddenError](https://docs.kuzzle.io/core/1/api/essentials/errors/#forbiddenerror) | cannot_delete_profile_being_used | api.security.cannot_delete_profile_being_used
2921  | `Anonymous profile must include the anonymous role` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_anonymous_role | api.security.missing_anonymous_role
2922  | `Unable to hydrate the profile <placeholder>: missing role(s) in the database` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | unable_to_hydrate_profile | api.security.unable_to_hydrate_profile
2923  | `Unable to find <placeholder> with id '<placeholder>'` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | unable_to_find_collection_with_id | api.security.unable_to_find_collection_with_id
2924  | `Bad argument: <placeholder> is not an array.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | ids_must_be_an_array | api.security.ids_must_be_an_array
2925  | `<placeholder>` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | load_from_cache | api.security.load_from_cache
2926  | `Repository <placeholder>: nothing to delete` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | nothing_to_delete_in_repository | api.security.nothing_to_delete_in_repository
2927  | `Repository <placeholder>: missing _id` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | missing_id_in_repository | api.security.missing_id_in_repository
2928  | `Missing role id` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_role_id | api.security.missing_role_id
2929  | `Invalid argument: Expected role id to be a string, received "<placeholder>"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | expected_role_id_to_be_a_string | api.security.expected_role_id_to_be_a_string
2930  | `Cannot remove login permission from anonymous role` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cannot_remove_login_permission_from_anonymous_role | api.security.cannot_remove_login_permission_from_anonymous_role
2931  | `<placeholder> is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cannot_delete_basic_role | api.security.cannot_delete_basic_role
2932  | `The role "<placeholder>" cannot be deleted since it is used by some profile.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | cannot_delete_role_being_used | api.security.cannot_delete_role_being_used
2933  | `was not able to remove bad credentials of user '<placeholder>'` | [PartialError](https://docs.kuzzle.io/core/1/api/essentials/errors/#partialerror) | unable_remove_bad_credentials | api.security.unable_remove_bad_credentials
2934  | `Anonymous user must be assigned the anonymous profile` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | anonymous_user_not_assigned_to_anonymous_profile | api.security.anonymous_user_not_assigned_to_anonymous_profile
2935  | `Unable to hydrate the user <placeholder>: missing profile(s) in the database` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | unable_to_hydrate_user | api.security.unable_to_hydrate_user
2936  | `Cannot get roles for uninitialized profile <placeholder>` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | cannot_get_roles_for_uninitialized_profile | api.security.cannot_get_roles_for_uninitialized_profile
2937  | `The "policies" attribute is mandatory and must be an array` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_mandatory_policies_attribute | api.security.missing_mandatory_policies_attribute
2938  | `The "policies" attribute array cannot be empty` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | empty_policies_attribute | api.security.empty_policies_attribute
2939  | `policies[<placeholder>] Missing mandatory attribute "roleId"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_mandatory_roleId_attribute | api.security.missing_mandatory_roleId_attribute
2940  | `policies[<placeholder>] Unexpected attribute "<placeholder>". Valid attributes are "roleId" and "restrictedTo"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unexpected_attribute_in_policies | api.security.unexpected_attribute_in_policies
2941  | `policies[<placeholder>] Expected "restrictedTo" to be an array of objects` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | attribute_restrictedTo_not_an_array_of_objects | api.security.attribute_restrictedTo_not_an_array_of_objects
2942  | `policies[<placeholder>].restrictedTo[<placeholder>] should be an object` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | restrictedTo_field_must_be_an_object | api.security.restrictedTo_field_must_be_an_object
2943  | `policies[<placeholder>].restrictedTo[<placeholder>] Missing mandatory attribute "index"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_mandatory_index_attribute_in_restrictedTo_array | api.security.missing_mandatory_index_attribute_in_restrictedTo_array
2944  | `policies[<placeholder>].restrictedTo[<placeholder>] Attribute "index" must be a non-empty string value` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | index_attribute_is_empty_string | api.security.index_attribute_is_empty_string
2945  | `policies[<placeholder>].restrictedTo[<placeholder>] Attribute "collections" must be of type "array"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | attribute_collections_not_an_array_in_retrictedTo | api.security.attribute_collections_not_an_array_in_retrictedTo
2946  | `policies[<placeholder>].restrictedTo[<placeholder>] Attribute "collections" can only contain non-empty string values` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | attribute_collections_not_contains_not_only_non_empty_strings | api.security.attribute_collections_not_contains_not_only_non_empty_strings
2947  | `policies[<placeholder>].restrictedTo[<placeholder>] Unexpected attribute "<placeholder>". Valid attributes are "index" and "collections"` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unexptected_attribute_in_restrictedTo_array | api.security.unexptected_attribute_in_restrictedTo_array
2948  | `Cannot get profiles for uninitialized user <placeholder>` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | cannot_get_profiles_for_uninitialized_user | api.security.cannot_get_profiles_for_uninitialized_user
2949  | `Cannot check permissions on uninitialized role <placeholder>` | [PreconditionError](https://docs.kuzzle.io/core/1/api/essentials/errors/#preconditionerror) | cannot_check_permissions_on_uninitialized_role | api.security.cannot_check_permissions_on_uninitialized_role
2950  | `Invalid rights given for role <placeholder>(<placeholder>) : <placeholder>` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | invalid_rights_given | api.security.invalid_rights_given
2951  | `The "controllers" definition must be an object` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | controllers_definition_not_an_object | api.security.controllers_definition_not_an_object
2952  | `The "controllers" definition cannot be empty` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | empty_controllers_definition | api.security.empty_controllers_definition
2953  | `Invalid definition for [<placeholder>]: must be an object` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | controller_definition_not_an_object | api.security.controller_definition_not_an_object
2954  | `Invalid definition for [<placeholder>]: cannot be empty` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | empty_controller_definition | api.security.empty_controller_definition
2955  | `Invalid definition for [<placeholder>]: "actions" attribute missing` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | actions_attribute_missing_in_controller_definition | api.security.actions_attribute_missing_in_controller_definition
2956  | `Invalid definition for [<placeholder>]: "actions" attribute must be an object` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | actions_attribute_not_an_object_in_controller_definition | api.security.actions_attribute_not_an_object_in_controller_definition
2957  | `Invalid definition for [<placeholder>]: "actions" attribute cannot be empty` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | actions_attribute_empty_in_controller_definition | api.security.actions_attribute_empty_in_controller_definition
2958  | `Invalid definition for [<placeholder>, <placeholder>]: must be a boolean or an object` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_type_in_definition_for_controller_action | api.security.invalid_type_in_definition_for_controller_action
2959  | `Invalid definition for [<placeholder>, <placeholder>]. Permissions defined as closures must have a "test" element.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_test_element_for_controller_action | api.security.missing_test_element_for_controller_action
2960  | `Invalid definition for [<placeholder>, <placeholder>]: error executing function` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | error_executing_function_for_controller_action | api.security.error_executing_function_for_controller_action
2961  | `Error parsing rights for role <placeholder> (<placeholder>) : <placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | parsing_rights_for_role | api.security.parsing_rights_for_role
2962  | `<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | parsing_closure_rights_for_role | api.security.parsing_closure_rights_for_role
2963  | `<placeholder>` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | rights_action_closure_execution | api.security.rights_action_closure_execution

---


### Subdomain: memory_storage, code: 10

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
2101  | `Invalid match parameter.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | match_parameter | api.memory_storage.match_parameter
2102  | `Invalid limit parameter.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | limit_parameter | api.memory_storage.limit_parameter
2103  | `Cannot add an empty points list.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | add_empty_points_list | api.memory_storage.add_empty_points_list
2104  | `Invalid points parameter.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | points_parameter | api.memory_storage.points_parameter
2105  | `Invalid entries parameter.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | entries_parameter | api.memory_storage.entries_parameter
2106  | `Invalid aggregate parameter.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | aggregate_parameter | api.memory_storage.aggregate_parameter
2107  | `Invalid value for parameter <placeholder>: float expected.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | float_expected | api.memory_storage.float_expected
2108  | `Invalid value for parameter <placeholder>: integer expected.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | integer_expected | api.memory_storage.integer_expected
2109  | `At least 1 source key must be provided.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | no_source_key | api.memory_storage.no_source_key
21010  | `At least 1 score/member pair must be provided.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | no_score_member_pair | api.memory_storage.no_score_member_pair
21011  | `No more than 1 score/member pair can be specified when the 'incr' option is set.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | too_many_score_member_pairs | api.memory_storage.too_many_score_member_pairs
21012  | `Invalid score/member pair argument.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_score_member_pair | api.memory_storage.invalid_score_member_pair
21013  | `Missing argument <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | missing_argument | api.memory_storage.missing_argument
21014  | `Accepts only scalar values (number, string).` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | non_scalar_value | api.memory_storage.non_scalar_value
21015  | `NX and XX options are mutually exclusive.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | nx_xx_exclusive_opts | api.memory_storage.nx_xx_exclusive_opts
21016  | `EX and PX options are mutually exclusive.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | ex_px_exclusive_opts | api.memory_storage.ex_px_exclusive_opts
21017  | `Invalid direction argument (expected: ASC or DESC).` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | direction_argument | api.memory_storage.direction_argument

---

---

## network, code: 3



### Subdomain: http, code: 1

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
311  | `<placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | http_request_error | network.http.http_request_error
312  | `Maximum HTTP request size exceeded.` | [SizeLimitError](https://docs.kuzzle.io/core/1/api/essentials/errors/#sizelimiterror) | http_request_size_exceeded | network.http.http_request_size_exceeded
313  | `Too many encodings.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | too_many_encodings | network.http.too_many_encodings
314  | `Unsupported compression algorithm "<placeholder>".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unsupported_compression_algorithm | network.http.unsupported_compression_algorithm
315  | `Compression support is disabled.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | compression_support_disabled | network.http.compression_support_disabled

---


### Subdomain: mqtt, code: 2

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
321  | `<placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | mqtt_request_error | network.mqtt.mqtt_request_error

---


### Subdomain: websocket, code: 3

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
331  | `<placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | websocket_request_error | network.websocket.websocket_request_error

---


### Subdomain: socketio, code: 4

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |

---


### Subdomain: entrypoint, code: 5

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
351  | `Unknown event received: <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | unknown_event_received | network.entrypoint.unknown_event_received
352  | `Invalid network port number: <placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | invalid_network_port_number | network.entrypoint.invalid_network_port_number
353  | `Conflicting protocol name "<placeholder>".` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | conflicting_protocol_name | network.entrypoint.conflicting_protocol_name

---


### Subdomain: http_router, code: 6

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
361  | `Unrecognized HTTP method <placeholder>.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unrecognized_http_method | network.http_router.unrecognized_http_method
362  | `API URL not found: <placeholder>.` | [NotFoundError](https://docs.kuzzle.io/core/1/api/essentials/errors/#notfounderror) | api_url_not_found | network.http_router.api_url_not_found
363  | `Invalid request content-type. Expected "application/json", got: "<placeholder>".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_request_content_type | network.http_router.invalid_request_content_type
364  | `Invalid request charset. Expected "utf-8", got: "<placeholder>".` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | invalid_request_charset | network.http_router.invalid_request_charset
365  | `Unable to attach URL <placeholder>: URL path already exists.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | unable_to_attach_url | network.http_router.unable_to_attach_url
366  | `part already exists.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | part_already_exists | network.http_router.part_already_exists
367  | `Unable to convert HTTP x-kuzzle-volatile header to JSON.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unable_to_convert_http_header_to_json | network.http_router.unable_to_convert_http_header_to_json
368  | `Unable to convert HTTP body to JSON.` | [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) | unable_to_convert_http_body_to_json | network.http_router.unable_to_convert_http_body_to_json
369  | `<placeholder>.` | [InternalError](https://docs.kuzzle.io/core/1/api/essentials/errors/#internalerror) | request_error | network.http_router.request_error

---

---

## plugins, code: 4



### Subdomain: validation, code: 1

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
411  | `[<placeholder>] Invalid plugin name. The name must be comprised only of lowercased letters, numbers, hyphens and underscores.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_plugin_name | plugins.validation.invalid_plugin_name
412  | `[<placeholder>] Invalid "privileged" property: expected a boolean, got a <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_privileged_property | plugins.validation.invalid_privileged_property
413  | `[<placeholder>] No package.json file found.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_package_json | plugins.validation.missing_package_json
414  | `You must provide a valid User object when adding context with as().` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_user_object | plugins.validation.invalid_user_object
415  | `[<placeholder>] No "name" property provided in package.json.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_name_property_in_package_json | plugins.validation.missing_name_property_in_package_json
416  | `The collection must be specified.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | collection_not_specified | plugins.validation.collection_not_specified
417  | `Invalid argument: Expected callback to be a function, received "<placeholder>".` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | callback_argument_expected | plugins.validation.callback_argument_expected
418  | `Invalid argument: a Request object must be supplied.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_request_object | plugins.validation.missing_request_object
419  | `Custom event invalid name (<placeholder>). Colons are not allowed in custom events.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_custom_event_name | plugins.validation.invalid_custom_event_name
4110  | `A Request object and/or request data must be provided.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_request_data_or_object | plugins.validation.missing_request_data_or_object
4111  | `[<placeholder>] Strategy <placeholder>: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk).` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_strategy_registration | plugins.validation.invalid_strategy_registration
4112  | `<placeholder> expected the strategy description to be an object, got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | strategy_description_type | plugins.validation.strategy_description_type
4113  | `<placeholder> expected a "methods" property of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | methods_property_type | plugins.validation.methods_property_type
4114  | `<placeholder> expected a "<placeholder>" property of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | methodname_property_type | plugins.validation.methodname_property_type
4115  | `<placeholder> the strategy method "<placeholder>" must point to an exposed function.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_strategy_method | plugins.validation.invalid_strategy_method
4116  | `<placeholder> expected the "<placeholder>" property to be of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_property_type | plugins.validation.invalid_property_type
4118  | `<placeholder> expected a "config" property of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_config_property | plugins.validation.missing_config_property
4119  | `<placeholder> the "authenticator" and "constructor" parameters cannot both be set.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_set_ctor_and_authenticator | plugins.validation.cannot_set_ctor_and_authenticator
4120  | `<placeholder> invalid "constructor" property value: constructor expected.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_constructor_property_value | plugins.validation.invalid_constructor_property_value
4121  | `<placeholder> expected an "authenticator" property of type "string", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | authenticator_property_type | plugins.validation.authenticator_property_type
4122  | `<placeholder> unknown authenticator value: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unknown_authenticator_value | plugins.validation.unknown_authenticator_value
4123  | `<placeholder> expected the "<placeholder>" property to be of type "object", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | expected_object_type | plugins.validation.expected_object_type
4124  | `<placeholder> expected the "fields" property to be of type "array", got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_fields_property_type | plugins.validation.invalid_fields_property_type
4125  | `<placeholder> "<placeholder>" must be a non-empty string.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | key_cannot_be_empty_string | plugins.validation.key_cannot_be_empty_string
4126  | `<placeholder> Incorrect controller description type (expected object, got: "<placeholder>").` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | incorrect_controller_description_type | plugins.validation.incorrect_controller_description_type
4127  | `<placeholder> Unknown property "<placeholder>" in route definition. <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unknown_property_key_in_route_definition | plugins.validation.unknown_property_key_in_route_definition
4128  | `<placeholder> the exposed "strategies" plugin property must be a non-empty object.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | strategies_plugin_property_empty | plugins.validation.strategies_plugin_property_empty
4129  | `<placeholder> the exposed "authenticators" plugin property must be of type "object".` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | authenticators_plugin_property_not_an_object | plugins.validation.authenticators_plugin_property_not_an_object
4130  | `<placeholder> invalid authenticator <placeholder>: expected a constructor.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authenticator | plugins.validation.invalid_authenticator
4131  | `<placeholder> Only following http verbs are allowed: "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | http_verb_not_allowed | plugins.validation.http_verb_not_allowed
4132  | `[<placeholder>/manifest.json] Invalid "name" property: expected a non-empty string.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_name_property | plugins.validation.invalid_name_property
4133  | `[<placeholder>/manifest.json] A "name" property is required.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | missing_name_property | plugins.validation.missing_name_property
4134  | `The type <placeholder> must implement the function 'validate'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | function_validate_not_implemented | plugins.validation.function_validate_not_implemented
4135  | `The type <placeholder> must implement the function 'validateFieldSpecification'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | function_validateFieldSpecification_not_implemented | plugins.validation.function_validateFieldSpecification_not_implemented
4136  | `The allowing children type <placeholder> must implement the function 'getStrictness'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | function_getStrictness_not_implemented | plugins.validation.function_getStrictness_not_implemented
4137  | `[<placeholder>] Unable to load the file 'manifest.json'.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_load_manifest | plugins.validation.unable_to_load_manifest
4138  | `[<placeholder>/manifest.json] Version mismatch: current Kuzzle version <placeholder> does not match the manifest requirements (<placeholder>).` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | version_mismatch | plugins.validation.version_mismatch

---


### Subdomain: runtime, code: 2

| Code | Message          | Class              | Error              | FullName           |
------ | -----------------| ------------------ | ------------------ | ------------------ |
421  | `"realtime:<placeholder>" method is not available in plugins. You should use plugin hooks instead.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_use_realtime_method | plugins.runtime.cannot_use_realtime_method
422  | `Something went wrong during initialization of "<placeholder>" plugin.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_initialization_failed | plugins.runtime.plugin_initialization_failed
423  | `Plugin <placeholder> pipe for event '<placeholder>' threw a non-Kuzzle error: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_threw_non_kuzzle_error | plugins.runtime.plugin_threw_non_kuzzle_error
424  | `<placeholder> expected the "verify" to return a Promise, got: <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | verify_dont_return_promise | plugins.runtime.verify_dont_return_promise
425  | `<placeholder> invalid authentication strategy result.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authentication_strategy_result | plugins.runtime.invalid_authentication_strategy_result
426  | `<placeholder> invalid authentication kuid returned: expected a string, got a <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | invalid_authentication_kuid | plugins.runtime.invalid_authentication_kuid
427  | `<placeholder> returned an unknown Kuzzle user identifier.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unknown_kuzzle_user_identifier | plugins.runtime.unknown_kuzzle_user_identifier
428  | `Cannot remove strategy <placeholder>: owned by another plugin.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_remove_others_plugin_strategy | plugins.runtime.cannot_remove_others_plugin_strategy
429  | `Cannot remove strategy <placeholder>: strategy does not exist.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | cannot_remove_unexistant_strategy | plugins.runtime.cannot_remove_unexistant_strategy
4210  | `Undefined controller "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | undefined_controller | plugins.runtime.undefined_controller
4211  | `Undefined action "<placeholder>". <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | undefined_action | plugins.runtime.undefined_action
4212  | `Unable to load plugins from directory "<placeholder>"; <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_load_plugin_from_directory | plugins.runtime.unable_to_load_plugin_from_directory
4213  | `Unable to load plugin from path "<placeholder>"; <placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_load_plugin_from_path | plugins.runtime.unable_to_load_plugin_from_path
4214  | `[<placeholder>] No "init" method found.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | init_method_not_found | plugins.runtime.init_method_not_found
4215  | `The plugin "<placeholder>" is configured to run in privileged mode, but it does not seem to support it.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | privileged_mode_not_supported | plugins.runtime.privileged_mode_not_supported
4216  | `The plugin "<placeholder>" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | privileged_mode_not_setted | plugins.runtime.privileged_mode_not_setted
4217  | `A plugin named <placeholder> already exists` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_name_already_exists | plugins.runtime.plugin_name_already_exists
4218  | `Plugin <placeholder> is not a constructor.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_is_not_a_constructor | plugins.runtime.plugin_is_not_a_constructor
4219  | `<placeholder>.` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | plugin_error | plugins.runtime.plugin_error
4220  | `<placeholder>` | [UnauthorizedError](https://docs.kuzzle.io/core/1/api/essentials/errors/#unauthorizederror) | missing_user_for_authentication | plugins.runtime.missing_user_for_authentication
4221  | `<placeholder>` | [GatewayTimeoutError](https://docs.kuzzle.io/core/1/api/essentials/errors/#gatewaytimeouterror) | register_pipe_timeout | plugins.runtime.register_pipe_timeout
4222  | `Unable to serialize response. Are you trying to return the request?` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_serialize_response | plugins.runtime.unable_to_serialize_response
4223  | `An error occurred during the creation of user "<placeholder>":
<placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | user_creation | plugins.runtime.user_creation
4224  | `Unexpected return value from action "<placeholder>:<placeholder>": expected a Promise` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unexpected_return_value | plugins.runtime.unexpected_return_value
4225  | `Rejected new connection - invalid arguments: <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | rejected_new_connection_invalid_args | plugins.runtime.rejected_new_connection_invalid_args
4226  | `Unable to remove connection - invalid arguments: <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_remove_connection_invalid_args | plugins.runtime.unable_to_remove_connection_invalid_args
4227  | `Unable to remove connection - unknown connection identifier: <placeholder>` | [PluginImplementationError](https://docs.kuzzle.io/core/1/api/essentials/errors/#pluginimplementationerror) | unable_to_remove_connection_unknown_connection_identifier | plugins.runtime.unable_to_remove_connection_unknown_connection_identifier

---

---
