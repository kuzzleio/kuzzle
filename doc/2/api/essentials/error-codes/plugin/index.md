---
code: true
type: page
title: "0x04: plugin"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x04: plugin



### Subdomain: 0x0401: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.assert.invalid_plugins_dir<br/><pre>0x04010001</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | The enabled plugins directory cannot be opened |
| plugin.assert.cannot_load<br/><pre>0x04010002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Kuzzle is unable to load a plugin |
| plugin.assert.invalid_hook<br/><pre>0x04010003</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A hook must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.invalid_pipe<br/><pre>0x04010004</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A pipe must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.init_not_found<br/><pre>0x04010005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The plugin does not have an 'init' function |
| plugin.assert.privileged_not_supported<br/><pre>0x04010006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The 'privileged' flag has been set in Kuzzle's configuration for that plugin, but not in the plugin's manifest |
| plugin.assert.privileged_not_set<br/><pre>0x04010007</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The 'privileged' flag has been set in the plugin's manifest file, but it needs also to be added in Kuzzle's configuration |
| plugin.assert.not_a_constructor<br/><pre>0x04010008</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The exposed plugin is not a constructor |
| plugin.assert.name_already_exists<br/><pre>0x04010009</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Another plugin with the same name has already been loaded |
| plugin.assert.invalid_plugin_name<br/><pre>0x0401000a</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The plugin name in the manifest is invalid. Plugin can only contain lowercase letters and dash. |

---


### Subdomain: 0x0402: runtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.runtime.failed_init<br/><pre>0x04020001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | An exception was thrown by a plugin's init function |
| plugin.runtime.unexpected_error<br/><pre>0x04020002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Embeds an unexpected plugin error into a standardized KuzzleError object |
| plugin.runtime.too_many_pipes<br/><pre>0x04020004</pre> | [ServiceUnavailableError](/core/2/api/essentials/error-handling#serviceunavailableerror) <pre>(503)</pre> | The number of running pipes exceeds the configured capacity (see configuration files). This may be caused by pipes being too slow, or by an insufficient number of Kuzzle nodes. |

---


### Subdomain: 0x0403: strategy

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.strategy.invalid_description<br/><pre>0x04030001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.description field must be an object |
| plugin.strategy.invalid_methods<br/><pre>0x04030002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.methods field must be an object |
| plugin.strategy.invalid_method_type<br/><pre>0x04030003</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Method definitions in the strategy.methods configuration must be of type string |
| plugin.strategy.missing_method_function<br/><pre>0x04030004</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A required strategy method is missing |
| plugin.strategy.invalid_config<br/><pre>0x04030005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.config field must be an object |
| plugin.strategy.unexpected_constructor<br/><pre>0x04030006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The (deprecated) constructor property can only be set if there is no authenticator defined |
| plugin.strategy.invalid_constructor<br/><pre>0x04030007</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.constructor field must be a constructor |
| plugin.strategy.invalid_authenticator<br/><pre>0x04030008</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategy.authenticator field must be a string |
| plugin.strategy.unknown_authenticator<br/><pre>0x04030009</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | This strategy uses an authenticator that hasn't been declared in this.authenticators |
| plugin.strategy.invalid_option<br/><pre>0x0403000a</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | If defined, the "strategy.config.strategyOptions" and "strategy.config.authenticateOptions" properties must be objects |
| plugin.strategy.invalid_fields<br/><pre>0x0403000b</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The field strategy.config.fields must be an array or null |
| plugin.strategy.invalid_definition<br/><pre>0x0403000c</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The strategies property must be a non-empty object |
| plugin.strategy.failed_registration<br/><pre>0x0403000d</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Passportjs rejected this strategy (see the message for more information) |
| plugin.strategy.invalid_verify_return<br/><pre>0x0403000e</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method must return a promise |
| plugin.strategy.invalid_verify_resolve<br/><pre>0x0403000f</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" strategy method resolved to a non-object return value |
| plugin.strategy.invalid_kuid<br/><pre>0x04030010</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method returned an invalid kuid |
| plugin.strategy.unknown_kuid<br/><pre>0x04030011</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "verify" method returned an unknown kuid |
| plugin.strategy.unauthorized_removal<br/><pre>0x04030012</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Tried to remove a strategy owned by another plugin |
| plugin.strategy.strategy_not_found<br/><pre>0x04030013</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to remove a non-existent authentication strategy |
| plugin.strategy.missing_user<br/><pre>0x04030014</pre> | [UnauthorizedError](/core/2/api/essentials/error-handling#unauthorizederror) <pre>(401)</pre> | A strategy plugin approved credentials without providing a user object to Kuzzle |

---


### Subdomain: 0x0404: controller

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.controller.invalid_description<br/><pre>0x04040001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The controller description must be an object |
| plugin.controller.invalid_action<br/><pre>0x04040002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A controller action must be a function name, or a function |
| plugin.controller.unexpected_route_property<br/><pre>0x04040003</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | An unexpected property has been found in a controller route definition |
| plugin.controller.invalid_route_property<br/><pre>0x04040004</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Invalid route property format (must be a non-empty string) |
| plugin.controller.undefined_controller<br/><pre>0x04040005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route points to an non-existent controller |
| plugin.controller.undefined_action<br/><pre>0x04040006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route points to an non-existent controller action |
| plugin.controller.unsupported_verb<br/><pre>0x04040007</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A HTTP route is using an unsupported HTTP verb |
| plugin.controller.unserializable_response<br/><pre>0x04040008</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A plugin controller action returned a non-serializable response |
| plugin.controller.invalid_action_response<br/><pre>0x04040009</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | API actions added by plugins must return a promise |

---


### Subdomain: 0x0405: manifest

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.manifest.cannot_load<br/><pre>0x04050001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Unable to load the plugin's manifest file |
| plugin.manifest.version_mismatch<br/><pre>0x04050002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Current Kuzzle's version does not match the plugin's requirements |
| plugin.manifest.invalid_name_type<br/><pre>0x04050003</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Invalid plugin's name |
| plugin.manifest.invalid_name<br/><pre>0x04050004</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Invalid characters in a plugin's name |
| plugin.manifest.missing_name<br/><pre>0x04050005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A plugin name is required |
| plugin.manifest.invalid_errors<br/><pre>0x04050006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The 'errors' property format is invalid |
| plugin.manifest.invalid_privileged<br/><pre>0x04050007</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "privileged" property is invalid |
| plugin.manifest.missing_package<br/><pre>0x04050008</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The plugin is missing a 'package.json' file (run 'npm init' to create one) |
| plugin.manifest.missing_package_name<br/><pre>0x04050009</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A 'name' property in the 'package.json' file is required by Kuzzle, as it is used as the plugin's unique name |
| plugin.manifest.missing_version<br/><pre>0x0405000a</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Plugin manifest files must provide a kuzzleVersion parameter, with the range of compatible Kuzzle versions |

---


### Subdomain: 0x0406: context

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.context.missing_collection<br/><pre>0x04060001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The 'collection' argument is required, but none was provided |
| plugin.context.unavailable_realtime<br/><pre>0x04060002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Due to technical limitations, plugins have limited access to the realtime API controller |
| plugin.context.invalid_user<br/><pre>0x04060003</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The user object provided to the sdk.as() method is not a valid user with a least an '_id' property |
| plugin.context.invalid_callback<br/><pre>0x04060004</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A non-function callback has been provided |
| plugin.context.missing_request<br/><pre>0x04060005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A Request object is required, but none was supplied |
| plugin.context.missing_request_data<br/><pre>0x04060006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A Request object and/or request data must be provided |
| plugin.context.missing_authenticator<br/><pre>0x04060008</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Missing "strategy.config.authenticator" property |

---


### Subdomain: 0x0407: authenticators

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| plugin.authenticators.not_an_object<br/><pre>0x04070001</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | The "authenticators" property must be an object |
| plugin.authenticators.invalid_authenticator<br/><pre>0x04070002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Authenticators exposed in the "authenticators" object must be constructors |

---
