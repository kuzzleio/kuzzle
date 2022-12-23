---
code: true
type: page
title: "0x00: core| API | Core "
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x00: core



### Subdomain: 0x0000: fatal

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.fatal.unexpected_error<br/><pre>0x00000001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Caught an unexpected error: %s. | Caught an unexpected error. Please contact your support. |
| core.fatal.service_unavailable<br/><pre>0x00000002</pre>  | [ExternalServiceError](/core/2/api/errors/error-codes#externalserviceerror) <pre>(500)</pre> | Service unavailable: %s. | An external service is unavailable |
| core.fatal.service_timeout<br/><pre>0x00000003</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | [FATAL] Service "%s": initialization timeout | Service initialization timeout |
| core.fatal.unreadable_log_dir<br/><pre>0x00000004</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot read log directory '%s' : %s. | Cannot read the content of the log directory |
| core.fatal.assertion_failed<br/><pre>0x00000005</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Runtime assertion failed: %s | A runtime assertion has failed. Please contact support. |

---


### Subdomain: 0x0001: realtime

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.realtime.room_not_found<br/><pre>0x00010001</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | The room "%s" doesn't exist | The provided room identifier doesn't exist |
| core.realtime.invalid_rooms<br/><pre>0x00010002</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The "rooms" attribute must be an array. | The provided "rooms" argument is invalid |
| core.realtime.invalid_state<br/><pre>0x00010003</pre> <DeprecatedBadge version="2.0.0"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid value for the "state" parameter (allowed: "all", "done", "pending"). | An invalid value has been provided to the "state" argument |
| core.realtime.invalid_scope<br/><pre>0x00010004</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid value for the "scope" parameter (allowed: "all", "in", "out", "none"). | An invalid value has been provided to the "scope" argument |
| core.realtime.invalid_users<br/><pre>0x00010005</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid value for the "users" parameter (allowed: "all", "in", "out", "none"). | An invalid value has been provided to the "users" argument |
| core.realtime.too_many_terms<br/><pre>0x00010006</pre> <DeprecatedBadge version="2.12.3"/> | [SizeLimitError](/core/2/api/errors/error-codes#sizelimiterror) <pre>(413)</pre> | Unable to subscribe: maximum number of terms exceeded (max %s, received %s). | The number of filter terms exceeds the configured server limit |
| core.realtime.too_many_rooms<br/><pre>0x00010007</pre>  | [SizeLimitError](/core/2/api/errors/error-codes#sizelimiterror) <pre>(413)</pre> | Unable to subscribe: maximum number of unique rooms reached. | The configured number of unique rooms has been reached |
| core.realtime.not_subscribed<br/><pre>0x00010008</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | User "%s" has not subscribed to "%s". | Tried to manage a room while not having subscribed to it |

---


### Subdomain: 0x0002: vault

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.vault.cannot_decrypt<br/><pre>0x00020001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot decrypt secrets: %s. | Decryption of a vault file failed |
| core.vault.key_not_found<br/><pre>0x00020002</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot find vault key. Aborting. | A vault file has been provided without a vault key |

---


### Subdomain: 0x0003: configuration

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.configuration.invalid_type<br/><pre>0x00030001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Invalid type for the configuration parameter "%s" (expected: %s) | Wrong configuration parameter type |
| core.configuration.out_of_range<br/><pre>0x00030002</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | The configuration value set for "%s" is outside the allowed range (allowed: %s) | A configuration value exceeds the allowed range |
| core.configuration.cannot_parse<br/><pre>0x00030003</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unable to read kuzzlerc configuration file: %s | The kuzzlerc configuration file is badly formatted. |
| core.configuration.incompatible<br/><pre>0x00030004</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Incompatible configuration: %s | The kuzzlerc configuration file has incompatible configurations |

---


### Subdomain: 0x0004: sandbox

<DeprecatedBadge version="2.0.0">
| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.sandbox.process_already_running<br/><pre>0x00040001</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | A process is already running for this sandbox | A process is already running for this sandbox |
| core.sandbox.timeout<br/><pre>0x00040002</pre>  | [GatewayTimeoutError](/core/2/api/errors/error-codes#gatewaytimeouterror) <pre>(504)</pre> | Timeout. The sandbox did not respond within %sms. | Sandbox execution timed out |

---
</DeprecatedBadge>


### Subdomain: 0x0005: debugger

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| core.debugger.not_enabled<br/><pre>0x00050001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Debugger is not enabled | The debugger is not enabled |
| core.debugger.monitor_already_running<br/><pre>0x00050002</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The monitoring of "%s" is already running | The monitor is already running |
| core.debugger.monitor_not_running<br/><pre>0x00050003</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The monitoring of "%s" is not running | The monitor is not running |
| core.debugger.native_debug_protocol_usage_denied<br/><pre>0x00050004</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Usage of the native debug protocol is not allowed | Usage of the native debug protocol is not allowed |
| core.debugger.method_not_found<br/><pre>0x00050005</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Debugger method "%s" not found. | Debugger method not found |

---
