---
code: true
type: page
title: "0x02: api"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x02: api



### Subdomain: 0x0201: assert

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| api.assert.invalid_type<br/><pre>0x02010001</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Wrong type for argument "%s" (expected: %s) | Wrong argument type |
| api.assert.invalid_argument<br/><pre>0x02010002</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid argument "%s". Expected: %s | A request argument holds an invalid value |
| api.assert.missing_argument<br/><pre>0x02010003</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Missing argument "%s". | A required argument is missing |
| api.assert.empty_argument<br/><pre>0x02010004</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The argument "%s" is empty. | The argument cannot be empty |
| api.assert.mutually_exclusive<br/><pre>0x02010005</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Arguments "%s" and "%s" are mutually exclusive | Mutually exclusive parameters have been provided |
| api.assert.too_many_arguments<br/><pre>0x02010006</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Argument "%s" contains too many values | An argument contains too many keys or values |
| api.assert.unexpected_argument<br/><pre>0x02010007</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Unexpected argument "%s" (accepted arguments: %s) | An unexpected argument has been provided |
| api.assert.body_required<br/><pre>0x02010008</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The request must specify a body. | A request body is required |
| api.assert.unexpected_type_assertion<br/><pre>0x02010009</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | An unexepected type assertion "%s" has been invoked on attribute "%s". | Unexpected type assertion |
| api.assert.invalid_id<br/><pre>0x0201000a</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid "_id" value: cannot start with an underscore | _id values cannot start with an underscore |
| api.assert.forbidden_argument<br/><pre>0x0201000b</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The argument "%s" is not allowed by this API action. | A forbidden argument has been provided |
| api.assert.koncorde_unknown_keyword<br/><pre>0x0201000c</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The keyword "%s" is not part of Koncorde filters DSL keywords. Are you trying to use an Elasticsearch query? | An unknown keyword has been provided in filters |
| api.assert.koncorde_restricted_keyword<br/><pre>0x0201000d</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The %s "%s" of Koncorde DSL is not supported for search queries. | A restricted keyword has been provided in filters |
| api.assert.koncorde_dsl_error<br/><pre>0x0201000e</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | %s | Provided filters contains an error |
| api.assert.forbidden_stream<br/><pre>0x0201000f</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot set an HttpStream as a request's response in a non-http protocol | A forbidden HttpStream has been provided in a response |
| api.assert.unsupported_protocol<br/><pre>0x02010010</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | The protocol "%s" is not supported by the API action "%s". | A request has been made with an unsupported protocol |

---


### Subdomain: 0x0202: process

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| api.process.action_locked<br/><pre>0x02020001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Cannot execute action "%s": already executing. | Cannot execute the requested action because it's already executing |
| api.process.overloaded<br/><pre>0x02020002</pre>  | [ServiceUnavailableError](/core/2/api/errors/error-codes#serviceunavailableerror) <pre>(503)</pre> | Request discarded: Kuzzle Server is temporarily overloaded. | The request has been discarded because the server is overloaded |
| api.process.connection_dropped<br/><pre>0x02020003</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Client connection dropped | The request has been discarded because its linked client connection has dropped |
| api.process.controller_not_found<br/><pre>0x02020004</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | API controller "%s" not found. | API controller not found |
| api.process.action_not_found<br/><pre>0x02020005</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | API action "%s":"%s" not found | API controller action not found |
| api.process.incompatible_sdk_version<br/><pre>0x02020006</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Incompatible SDK client. Your SDK version (%s) does not match Kuzzle requirement (%s). | SDK is incompatible with the current Kuzzle version. You can set "config.server.strictSdkVersion" to false to disable this safety check at your own risk. |
| api.process.shutting_down<br/><pre>0x02020007</pre>  | [ServiceUnavailableError](/core/2/api/errors/error-codes#serviceunavailableerror) <pre>(503)</pre> | Rejected: this node is shutting down. | This Kuzzle node is shutting down and refuses new requests |
| api.process.too_many_requests<br/><pre>0x02020008</pre>  | [TooManyRequestsError](/core/2/api/errors/error-codes#toomanyrequestserror) <pre>(429)</pre> | Rejected: requests rate limit exceeded for this user. | The request has been refused because a rate limit has been exceeded for this user |
| api.process.admin_exists<br/><pre>0x02020009</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Admin user is already set. | Attempted to create the first administrator, when one already exists |
| api.process.incomplete_multiple_request<br/><pre>0x0202000a</pre>  | [MultipleErrorsError](/core/2/api/errors/error-codes#multipleerrorserror) <pre>(400)</pre> | At least one of the %s actions failed. | Failed to execute some or all actions requested |
| api.process.not_enough_nodes<br/><pre>0x0202000b</pre>  | [ServiceUnavailableError](/core/2/api/errors/error-codes#serviceunavailableerror) <pre>(503)</pre> | Rejected: this cluster is disabled because there aren't enough nodes connected. | The Kuzzle cluster has not enough nodes available, and no new requests can be processed until new nodes are added |
| api.process.unauthorized_origin<br/><pre>0x0202000c</pre>  | [UnauthorizedError](/core/2/api/errors/error-codes#unauthorizederror) <pre>(401)</pre> | The origin "%s" is not authorized. | The domain reaching out to Kuzzle is not authorized |
| api.process.too_many_logins_requests<br/><pre>0x0202000d</pre>  | [TooManyRequestsError](/core/2/api/errors/error-codes#toomanyrequestserror) <pre>(429)</pre> | Rejected: Too many login attempts per second | The request was denied because the maximum ("limits.loginsPerSecond") number of login attempts per second has been exceeded. |
| api.process.deprecated_embedded_sdk_action<br/><pre>0x0202000e</pre>  | [DeprecatedEmbeddedSdkAction](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The action %s of the controller %s has been called while it is deprecated %s. | A deprecated sdk action has been called |

---
