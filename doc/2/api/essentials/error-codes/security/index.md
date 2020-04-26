---
code: true
type: page
title: "0x07: security"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x07: security



### Subdomain: 0x0701: token

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.token.invalid<br/><pre>0x07010001</pre> | [UnauthorizedError](/core/2/api/essentials/error-handling#unauthorizederror) <pre>(401)</pre> | Invalid authentication token. |
| security.token.unknown_user<br/><pre>0x07010002</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Missing user or missing user identifier |
| security.token.unknown_connection<br/><pre>0x07010003</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Missing connection identifier |
| security.token.ttl_exceeded<br/><pre>0x07010004</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | An authentication token was requested with a TTL larger than the configured maximum value |
| security.token.generation_failed<br/><pre>0x07010005</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Unable to generate the requested authentication token |
| security.token.expired<br/><pre>0x07010006</pre> | [UnauthorizedError](/core/2/api/essentials/error-handling#unauthorizederror) <pre>(401)</pre> | The provided authentication token has expired |
| security.token.verification_error<br/><pre>0x07010007</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | An unexpected error occured while verifying an authentication token |

---


### Subdomain: 0x0702: credentials

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.credentials.unknown_strategy<br/><pre>0x07020001</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Unknown authentication strategy |
| security.credentials.database_inconsistency<br/><pre>0x07020002</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Inconsistency detected: credentials were found on a non-existing user |
| security.credentials.rejected<br/><pre>0x07020003</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | User's credentials were rejected during |

---


### Subdomain: 0x0703: rights

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.rights.unauthorized<br/><pre>0x07030001</pre> | [UnauthorizedError](/core/2/api/essentials/error-handling#unauthorizederror) <pre>(401)</pre> | Authentication required to execute this action |
| security.rights.forbidden<br/><pre>0x07030002</pre> | [ForbiddenError](/core/2/api/essentials/error-handling#forbiddenerror) <pre>(403)</pre> | Insufficient permissions to execute this action |

---


### Subdomain: 0x0704: user

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.user.already_exists<br/><pre>0x07040001</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Cannot create the user as it already exists |
| security.user.not_found<br/><pre>0x07040002</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing user |
| security.user.anonymous_profile_required<br/><pre>0x07040003</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The anonymous user must be assigned to the anonymous profile |
| security.user.cannot_hydrate<br/><pre>0x07040004</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Database inconsistency error: a user is referencing non-existing profiles |
| security.user.uninitialized<br/><pre>0x07040005</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized User object |
| security.user.prevent_override<br/><pre>0x07040006</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Attempted to override existing users. Change "onExistingUsers" params to modify this method behavior. |

---


### Subdomain: 0x0705: role

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.role.not_found<br/><pre>0x07050001</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing role |
| security.role.login_required<br/><pre>0x07050002</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Cannot remove the "login" action from the anonymous role |
| security.role.cannot_delete<br/><pre>0x07050003</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Attempted to delete a base role (anonymous, default, admin) |
| security.role.in_use<br/><pre>0x07050004</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | A role still assigned to profiles cannot be deleted |
| security.role.uninitialized<br/><pre>0x07050005</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized Role object |
| security.role.unknown_controller<br/><pre>0x07050009</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Trying to set a role with a non-existing controller |
| security.role.unknown_action<br/><pre>0x0705000a</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Trying to set a role with a non-existing controller action |

---


### Subdomain: 0x0706: profile

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| security.profile.not_found<br/><pre>0x07060001</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existing profile |
| security.profile.cannot_delete<br/><pre>0x07060002</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Attempted to delete a base profile (anonymous, default, admin) |
| security.profile.in_use<br/><pre>0x07060003</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | A profile still assigned to users cannot be deleted |
| security.profile.cannot_hydrate<br/><pre>0x07060004</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Database inconsistency error: a profile is referencing non-existing roles |
| security.profile.missing_anonymous_role<br/><pre>0x07060005</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The anonymous profile must include the anonymous role |
| security.profile.uninitialized<br/><pre>0x07060006</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | Attempted to access to an unitialized Profile object |

---
