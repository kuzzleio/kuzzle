---
code: true
type: page
title: "0x00: core"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x00: core



### Subdomain: 0x0000: fatal

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.fatal.unexpected_error<br/><pre>0x00000001</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Caught an unexpected error. Please contact your support. |
| core.fatal.service_unavailable<br/><pre>0x00000002</pre> | [ExternalServiceError](/core/2/api/essentials/error-handling#externalserviceerror) <pre>(500)</pre> | An external service is unavailable |
| core.fatal.service_timeout<br/><pre>0x00000003</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Service initialization timeout |
| core.fatal.unreadable_log_dir<br/><pre>0x00000004</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Cannot read the content of the log directory |
| core.fatal.orphan_ask_event<br/><pre>0x00000005</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Internal error: the requested 'ask' event doesn't have an answerer |

---


### Subdomain: 0x0001: realtime

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.realtime.room_not_found<br/><pre>0x00010001</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | The provided room identifier doesn't exist |
| core.realtime.invalid_rooms<br/><pre>0x00010002</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The provided "rooms" argument is invalid |
| core.realtime.invalid_scope<br/><pre>0x00010004</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | An invalid value has been provided to the "scope" argument |
| core.realtime.invalid_users<br/><pre>0x00010005</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | An invalid value has been provided to the "users" argument |
| core.realtime.too_many_terms<br/><pre>0x00010006</pre> | [SizeLimitError](/core/2/api/essentials/error-handling#sizelimiterror) <pre>(413)</pre> | The number of filter terms exceeds the configured server limit |
| core.realtime.too_many_rooms<br/><pre>0x00010007</pre> | [SizeLimitError](/core/2/api/essentials/error-handling#sizelimiterror) <pre>(413)</pre> | The configured number of unique rooms has been reached |
| core.realtime.not_subscribed<br/><pre>0x00010008</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Tried to manage a room while not having subscribed to it |

---


### Subdomain: 0x0002: vault

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.vault.cannot_decrypt<br/><pre>0x00020001</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Decryption of a vault file failed |
| core.vault.key_not_found<br/><pre>0x00020002</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | A vault file has been provided without a vault key |

---


### Subdomain: 0x0003: configuration

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| core.configuration.invalid_type<br/><pre>0x00030001</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Wrong configuration parameter type |
| core.configuration.out_of_range<br/><pre>0x00030002</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | A configuration value exceeds the allowed range |

---
