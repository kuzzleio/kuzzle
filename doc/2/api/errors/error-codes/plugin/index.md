---
code: true
type: page
title: "0x04: plugin"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x04: plugin



### Subdomain: 0x0401: assert

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.assert.invalid_plugins_dir<br/><pre>0x04010001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unable to read plugins directory "%s"; %s. | The enabled plugins directory cannot be opened |
| plugin.assert.cannot_load<br/><pre>0x04010002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Unable to load plugin from path "%s"; %s. | Kuzzle is unable to load a plugin |
| plugin.assert.invalid_hook<br/><pre>0x04010003</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Unable to configure a hook for the event "%s": "%s" should be a function. %s | A hook must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.invalid_pipe<br/><pre>0x04010004</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Unable to configure a pipe for the event "%s": "%s" should be a function. %s | A pipe must point to either a function named directly exposed by the plugin, or a function. This error is thrown when a hook property is configured with neither of these values |
| plugin.assert.init_not_found<br/><pre>0x04010005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Plugin "%s": No "init" method found. | The plugin does not have an 'init' function |
| plugin.assert.privileged_not_supported<br/><pre>0x04010006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | The plugin "%s" is configured to run in privileged mode, but it does not seem to support it. | The 'privileged' flag has been set in Kuzzle's configuration for that plugin, but not in the plugin's manifest |
| plugin.assert.privileged_not_set<br/><pre>0x04010007</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | The plugin "%s" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration. | The 'privileged' flag has been set in the plugin's manifest file, but it needs also to be added in Kuzzle's configuration |
| plugin.assert.not_a_constructor<br/><pre>0x04010008</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Plugin "%s" is not a constructor. | The exposed plugin is not a constructor |
| plugin.assert.name_already_exists<br/><pre>0x04010009</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | A plugin named %s already exists | Another plugin with the same name has already been loaded |
| plugin.assert.invalid_plugin_name<br/><pre>0x0401000a</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Plugin name "%s" is invalid. Plugin names must be in kebab-case. | The plugin name is invalid. Plugin names can only contain lowercase letters and dashes. |
| plugin.assert.no_name_provided<br/><pre>0x0401000b</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Cannot infer plugin name. No constructor method and no name provided | The plugin does not have a constructor method and no name has been provided. |
| plugin.assert.invalid_controller_definition<br/><pre>0x0401000c</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Incorrect "%s" controller definition: %s | The controller definition is incorrect. |
| plugin.assert.invalid_application_name<br/><pre>0x0401000d</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Application name "%s" is invalid. Application names must be in kebab-case. | The application name is invalid. Application names can only contain lowercase letters and dashes. |
| plugin.assert.duplicated_api_definition<br/><pre>0x0401000e</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Cannot define new controllers in the "api" and the "controllers" objects at the same time | You cannot use the "api" and the "controllers" objects at the same time. Use the "api" object to define controllers. |

---


### Subdomain: 0x0402: runtime

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.runtime.failed_init<br/><pre>0x04020001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Something went wrong during initialization of "%s" plugin. | An exception was thrown by a plugin's init function |
| plugin.runtime.unexpected_error<br/><pre>0x04020002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Caught an unexpected plugin error: %s | Embeds an unexpected plugin error into a standardized KuzzleError object |
| plugin.runtime.pipe_timeout<br/><pre>0x04020003</pre> <DeprecatedBadge version="2.2.0"/> | [GatewayTimeoutError](/core/2/api/errors/error-codes#gatewaytimeouterror) <pre>(504)</pre> | Plugin "%s": timeout error. A pipe on the event "%s" exceeded the timeout delay (%sms). Aborting. | A pipe function execution took more than the configured server limit |
| plugin.runtime.too_many_pipes<br/><pre>0x04020004</pre>  | [ServiceUnavailableError](/core/2/api/errors/error-codes#serviceunavailableerror) <pre>(503)</pre> | Request discarded: maximum number of executing pipe functions reached. | The number of running pipes exceeds the configured capacity (see configuration files). This may be caused by pipes being too slow, or by an insufficient number of Kuzzle nodes. |
| plugin.runtime.already_started<br/><pre>0x04020005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Cannot use property "%s" when application is already running | Features definition cannot be changed after startup. |
| plugin.runtime.unavailable_before_start<br/><pre>0x04020006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Cannot use property "%s" before application startup | The property is only accessible after application startup. |

---


### Subdomain: 0x0403: strategy

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.strategy.invalid_description<br/><pre>0x04030001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected the strategy description to be an object, got: %s. | The strategy.description field must be an object |
| plugin.strategy.invalid_methods<br/><pre>0x04030002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected a "methods" property of type "object", got: %s. | The strategy.methods field must be an object |
| plugin.strategy.invalid_method_type<br/><pre>0x04030003</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected a "%s" property of type "string", got: %s. | Method definitions in the strategy.methods configuration must be of type string |
| plugin.strategy.missing_method_function<br/><pre>0x04030004</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s the strategy method "%s" must point to an exposed function. | A required strategy method is missing |
| plugin.strategy.invalid_config<br/><pre>0x04030005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected a "config" property of type "object", got: %s. | The strategy.config field must be an object |
| plugin.strategy.unexpected_constructor<br/><pre>0x04030006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s the "authenticator" and "constructor" parameters cannot both be set. | The (deprecated) constructor property can only be set if there is no authenticator defined |
| plugin.strategy.invalid_constructor<br/><pre>0x04030007</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s invalid "constructor" property value: constructor expected. | The strategy.constructor field must be a constructor |
| plugin.strategy.invalid_authenticator<br/><pre>0x04030008</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected an "authenticator" property of type "string", got: %s. | The strategy.authenticator field must be a string |
| plugin.strategy.unknown_authenticator<br/><pre>0x04030009</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s unknown authenticator: %s. | This strategy uses an authenticator that hasn't been declared in this.authenticators |
| plugin.strategy.invalid_option<br/><pre>0x0403000a</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected the "%s" property to be of type "object", got: %s. | If defined, the "strategy.config.strategyOptions" and "strategy.config.authenticateOptions" properties must be objects |
| plugin.strategy.invalid_fields<br/><pre>0x0403000b</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s expected the "fields" property to be of type "array", got: %s. | The field strategy.config.fields must be an array or null |
| plugin.strategy.invalid_definition<br/><pre>0x0403000c</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s the exposed "strategies" plugin property must be a non-empty object. | The strategies property must be a non-empty object |
| plugin.strategy.failed_registration<br/><pre>0x0403000d</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Failed to register strategy "%s": %s | Passportjs rejected this strategy (see the message for more information) |
| plugin.strategy.invalid_verify_return<br/><pre>0x0403000e</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s The "verify" method is expected to return a Promise, got: %s. | The "verify" method must return a promise |
| plugin.strategy.invalid_verify_resolve<br/><pre>0x0403000f</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s invalid authentication strategy result (expected an object). | The "verify" strategy method resolved to a non-object return value |
| plugin.strategy.invalid_kuid<br/><pre>0x04030010</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s invalid authentication kuid returned: expected a string, got a %s. | The "verify" method returned an invalid kuid |
| plugin.strategy.unknown_kuid<br/><pre>0x04030011</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s returned an unknown Kuzzle user identifier. | The "verify" method returned an unknown kuid |
| plugin.strategy.unauthorized_removal<br/><pre>0x04030012</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Cannot remove strategy %s: owned by another plugin. | Tried to remove a strategy owned by another plugin |
| plugin.strategy.strategy_not_found<br/><pre>0x04030013</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Cannot remove strategy %s: strategy does not exist. | Attempted to remove a non-existent authentication strategy |
| plugin.strategy.missing_user<br/><pre>0x04030014</pre>  | [UnauthorizedError](/core/2/api/errors/error-codes#unauthorizederror) <pre>(401)</pre> | %s | A strategy plugin approved credentials without providing a user object to Kuzzle |

---


### Subdomain: 0x0404: controller

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.controller.invalid_description<br/><pre>0x04040001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Invalid controller description type (expected object, got: "%s"). | The controller description must be an object |
| plugin.controller.invalid_action<br/><pre>0x04040002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Action for "%s" is neither a function nor a function name. %s | A controller action must be a function name, or a function |
| plugin.controller.unexpected_route_property<br/><pre>0x04040003</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Unexpected property "%s" in route definition. %s | An unexpected property has been found in a controller route definition |
| plugin.controller.invalid_route_property<br/><pre>0x04040004</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s "%s" must be a non-empty string. | Invalid route property format (must be a non-empty string) |
| plugin.controller.undefined_controller<br/><pre>0x04040005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Undefined controller "%s". %s | A HTTP route points to an non-existent controller |
| plugin.controller.undefined_action<br/><pre>0x04040006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Undefined action "%s". %s | A HTTP route points to an non-existent controller action |
| plugin.controller.unsupported_verb<br/><pre>0x04040007</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s Only the following http verbs are allowed: "%s". %s | A HTTP route is using an unsupported HTTP verb |
| plugin.controller.unserializable_response<br/><pre>0x04040008</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Unable to serialize response. Are you trying to return the request? | A plugin controller action returned a non-serializable response |
| plugin.controller.invalid_action_response<br/><pre>0x04040009</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Unexpected return value from action "%s:%s": expected a Promise | API actions added by plugins must return a promise |

---


### Subdomain: 0x0405: manifest

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.manifest.cannot_load<br/><pre>0x04050001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] Unable to load the file 'manifest.json': %s | Unable to load the plugin's manifest file |
| plugin.manifest.version_mismatch<br/><pre>0x04050002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s/manifest.json] Version mismatch: current Kuzzle version %s does not match the manifest requirements (%s). | Current Kuzzle's version does not match the plugin's requirements |
| plugin.manifest.invalid_name_type<br/><pre>0x04050003</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] Invalid "name" property: expected a non-empty string. | Invalid plugin's name |
| plugin.manifest.invalid_name<br/><pre>0x04050004</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] Invalid plugin name. The name must be comprised only of letters, numbers, hyphens and underscores. | Invalid characters in a plugin's name |
| plugin.manifest.missing_name<br/><pre>0x04050005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] A "name" property is required. | A plugin name is required |
| plugin.manifest.invalid_errors<br/><pre>0x04050006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] errors field in manifest.json badly formatted: %s | The 'errors' property format is invalid |
| plugin.manifest.invalid_privileged<br/><pre>0x04050007</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] Invalid "privileged" property: expected a boolean, got a %s. | The "privileged" property is invalid |
| plugin.manifest.missing_package<br/><pre>0x04050008</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] No package.json file found. | The plugin is missing a 'package.json' file (run 'npm init' to create one) |
| plugin.manifest.missing_package_name<br/><pre>0x04050009</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] No "name" property provided in package.json. | A 'name' property in the 'package.json' file is required by Kuzzle, as it is used as the plugin's unique name |
| plugin.manifest.missing_version<br/><pre>0x0405000a</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] A "kuzzleVersion" property is required | Plugin manifest must provide a kuzzleVersion parameter, with the range of compatible Kuzzle versions |

---


### Subdomain: 0x0406: context

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.context.missing_collection<br/><pre>0x04060001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Missing collection argument. | The 'collection' argument is required, but none was provided |
| plugin.context.unavailable_realtime<br/><pre>0x04060002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | The method "realtime:%s" is unavailable with execute(). Use the embedded SDK instead. | Due to technical limitations, subscribe and unsubscribe methods are only available through the embedded SDK. |
| plugin.context.invalid_user<br/><pre>0x04060003</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | You must provide a valid User object when adding context with as(). | The user object provided to the sdk.as() method is not a valid user with a least an '_id' property |
| plugin.context.invalid_callback<br/><pre>0x04060004</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: Expected callback to be a function, received "%s". | A non-function callback has been provided |
| plugin.context.missing_request<br/><pre>0x04060005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Invalid argument: a Request object must be supplied. | A Request object is required, but none was supplied |
| plugin.context.missing_request_data<br/><pre>0x04060006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | A Request object and/or request data must be provided. | A Request object and/or request data must be provided |
| plugin.context.invalid_event<br/><pre>0x04060007</pre> <DeprecatedBadge version="2.2.0"/> | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Custom event invalid name (%s). Colons are not allowed in custom events. | Invalid event name (colons are not allowed in event names) |
| plugin.context.missing_authenticator<br/><pre>0x04060008</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | [%s] Strategy %s: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk). | Missing "strategy.config.authenticator" property |

---


### Subdomain: 0x0407: authenticators

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| plugin.authenticators.not_an_object<br/><pre>0x04070001</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s the exposed "authenticators" plugin property must be of type "object". | The "authenticators" property must be an object |
| plugin.authenticators.invalid_authenticator<br/><pre>0x04070002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | %s invalid authenticator.%s property: expected a constructor. | Authenticators exposed in the "authenticators" object must be constructors |

---
