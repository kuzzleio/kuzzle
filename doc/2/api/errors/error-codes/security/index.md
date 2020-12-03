---
code: true
type: page
title: "0x07: security"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x07: security



### Subdomain: 0x0701: token

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.token.invalid<br/><pre>0x07010001</pre>  | [UnauthorizedError](/core/2/api/errors/error-codes#unauthorizederror) <pre>(401)</pre> | Invalid token. | Invalid authentication token. |
| security.token.unknown_user<br/><pre>0x07010002</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unknown User : cannot generate token | Missing user or missing user identifier |
| security.token.unknown_connection<br/><pre>0x07010003</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unknown connection : cannot generate token | Missing connection identifier |
| security.token.ttl_exceeded<br/><pre>0x07010004</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | expiresIn value exceeds maximum allowed value | An authentication token was requested with a TTL larger than the configured maximum value |
| security.token.generation_failed<br/><pre>0x07010005</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Error while generating token: %s | Unable to generate the requested authentication token |
| security.token.expired<br/><pre>0x07010006</pre>  | [UnauthorizedError](/core/2/api/errors/error-codes#unauthorizederror) <pre>(401)</pre> | Token expired | The provided authentication token has expired |
| security.token.verification_error<br/><pre>0x07010007</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Error verifying token: %s | An unexpected error occured while verifying an authentication token |

---


### Subdomain: 0x0702: credentials

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.credentials.unknown_strategy<br/><pre>0x07020001</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Unknown authentication strategy "%s" | Unknown authentication strategy |
| security.credentials.database_inconsistency<br/><pre>0x07020002</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Internal database inconsistency detected: existing credentials found on non-existing user %s. | Inconsistency detected: credentials were found on a non-existing user |
| security.credentials.rejected<br/><pre>0x07020003</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Credentials rejected: %s | User's credentials were rejected during |

---


### Subdomain: 0x0703: rights

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.rights.unauthorized<br/><pre>0x07030001</pre>  | [UnauthorizedError](/core/2/api/errors/error-codes#unauthorizederror) <pre>(401)</pre> | Unauthorized: authentication required to execute the action "%s:%s". | Authentication required to execute this action |
| security.rights.forbidden<br/><pre>0x07030002</pre>  | [ForbiddenError](/core/2/api/errors/error-codes#forbiddenerror) <pre>(403)</pre> | Insufficient permissions to execute the action "%s:%s" (User "%s"). | Insufficient permissions to execute this action |

---


### Subdomain: 0x0704: user

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.user.already_exists<br/><pre>0x07040001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | User %s already exists. | Cannot create the user as it already exists |
| security.user.not_found<br/><pre>0x07040002</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | User "%s" not found. | Attempted to access to a non-existing user |
| security.user.anonymous_profile_required<br/><pre>0x07040003</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The anonymous user must be assigned to the anonymous profile | The anonymous user must be assigned to the anonymous profile |
| security.user.cannot_hydrate<br/><pre>0x07040004</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unable to hydrate the user "%s": missing profile(s) in the database | Database inconsistency error: a user is referencing non-existing profiles |
| security.user.uninitialized<br/><pre>0x07040005</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot get profiles for uninitialized user "%s" | Attempted to access to an unitialized User object |
| security.user.prevent_overwrite<br/><pre>0x07040006</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot overwrite existing users. | Attempted to overwrite existing users. Change "onExistingUsers" params to modify this method behavior. |
| security.user.no_profile<br/><pre>0x07040007</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot load user "%s": there is no security profiles associated to it | Database inconsistency error: a user does not have profiles associated to it |

---


### Subdomain: 0x0705: role

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.role.not_found<br/><pre>0x07050001</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Role "%s" not found. | Attempted to access to a non-existing role |
| security.role.login_required<br/><pre>0x07050002</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Cannot remove the "login" action from the anonymous role. | Cannot remove the "login" action from the anonymous role |
| security.role.cannot_delete<br/><pre>0x07050003</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The following roles are protected and cannot be deleted: anonymous, default, admin | Attempted to delete a base role (anonymous, default, admin) |
| security.role.in_use<br/><pre>0x07050004</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The role "%s" is still used and cannot be deleted. | A role still assigned to profiles cannot be deleted |
| security.role.uninitialized<br/><pre>0x07050005</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot check permissions on the uninitialized role "%s" | Attempted to access to an unitialized Role object |
| security.role.invalid_rights<br/><pre>0x07050006</pre> <DeprecatedBadge version="2.2.0"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid rights for role "%s" (path: "%s"): %s | Invalid rights |
| security.role.closure_exec_failed<br/><pre>0x07050007</pre> <DeprecatedBadge version="2.2.0"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid definition for [%s, %s]: %s | Execution failed on the provided closure |
| security.role.closure_missing_test<br/><pre>0x07050008</pre> <DeprecatedBadge version="2.2.0"/> | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Missing or malformed "test" attribute  for role %s (%s) : %s | Closures must specify a "test" attribute |
| security.role.unknown_controller<br/><pre>0x07050009</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Trying to set role %s with a non-existing controller '%s'. %s | Trying to set a role with a non-existing controller |
| security.role.unknown_action<br/><pre>0x0705000a</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Trying to set role %s with a non-existing action '%s' in controller '%s'. %s | Trying to set a role with a non-existing controller action |

---


### Subdomain: 0x0706: profile

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| security.profile.not_found<br/><pre>0x07060001</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | Profile "%s" not found. | Attempted to access to a non-existing profile |
| security.profile.cannot_delete<br/><pre>0x07060002</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The following profiles are protected and cannot be deleted: anonymous, default, admin | Attempted to delete a base profile (anonymous, default, admin) |
| security.profile.in_use<br/><pre>0x07060003</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The profile "%s" is still used and cannot be deleted. | A profile still assigned to users cannot be deleted |
| security.profile.cannot_hydrate<br/><pre>0x07060004</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Unable to hydrate the profile "%s": missing role(s) in the database | Database inconsistency error: a profile is referencing non-existing roles |
| security.profile.missing_anonymous_role<br/><pre>0x07060005</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | The anonymous profile must include the anonymous role | The anonymous profile must include the anonymous role |
| security.profile.uninitialized<br/><pre>0x07060006</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Cannot get roles for uninitialized profile "%s" | Attempted to access to an unitialized Profile object |

---
