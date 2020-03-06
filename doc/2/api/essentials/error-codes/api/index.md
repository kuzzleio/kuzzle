---
code: true
type: page
title: "0x02: api"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x02: api



### Subdomain: 0x0201: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.assert.invalid_type<br/><pre>0x02010001</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Wrong argument type |
| api.assert.invalid_argument<br/><pre>0x02010002</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A request argument holds an invalid value |
| api.assert.missing_argument<br/><pre>0x02010003</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A required argument is missing |
| api.assert.empty_argument<br/><pre>0x02010004</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The argument cannot be empty |
| api.assert.mutually_exclusive<br/><pre>0x02010005</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Mutually exclusive parameters have been provided |
| api.assert.too_many_arguments<br/><pre>0x02010006</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | An argument contains too many keys or values |
| api.assert.unexpected_argument<br/><pre>0x02010007</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | An unexpected argument has been provided |
| api.assert.body_required<br/><pre>0x02010008</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A request body is required |
| api.assert.unexpected_type_assertion<br/><pre>0x02010009</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Unexpected type assertion |
| api.assert.invalid_id<br/><pre>0x0201000a</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | _id values cannot start with an underscore |
| api.assert.forbidden_argument<br/><pre>0x0201000b</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | A forbidden argument has been provided |

---


### Subdomain: 0x0202: process

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| api.process.action_locked<br/><pre>0x02020001</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Cannot execute the requested action because it's already executing |
| api.process.overloaded<br/><pre>0x02020002</pre> | [ServiceUnavailableError](/core/2/api/essentials/error-handling#serviceunavailableerror) <pre>(503)</pre> | The request has been discarded because the server is overloaded |
| api.process.connection_dropped<br/><pre>0x02020003</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The request has been discarded because its linked client connection has dropped |
| api.process.controller_not_found<br/><pre>0x02020004</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | API controller not found |
| api.process.action_not_found<br/><pre>0x02020005</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | API controller action not found |
| api.process.incompatible_sdk_version<br/><pre>0x02020006</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | SDK is incompatible with the current Kuzzle version |
| api.process.shutting_down<br/><pre>0x02020007</pre> | [ServiceUnavailableError](/core/2/api/essentials/error-handling#serviceunavailableerror) <pre>(503)</pre> | This Kuzzle node is shutting down and refuses new requests |
| api.process.too_many_requests<br/><pre>0x02020008</pre> | [TooManyRequestsError](/core/2/api/essentials/error-handling#toomanyrequestserror) <pre>(429)</pre> | The request has been refused because a rate limit has been exceeded for this user |

---
