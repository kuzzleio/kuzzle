---
code: true
type: page
title: restrictDefaultRights | API | Core
---

# restrictDefaultRights

Applies the configured restricted rights to the `anonymous` and `default` roles.

By default, these roles are permissive. This action replaces those roles' definitions
with the sets defined under the `security.standard.roles` and `security.standard.profiles`
configuration keys. It's primarily used to lock down access immediately after
creating the first administrator (see [createFirstAdmin](/core/2/api/controllers/security/create-first-admin)).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_restrictDefaultRights
Method: POST
Body: (empty)
```

### Other protocols

```js
{
  "controller": "security",
  "action": "restrictDefaultRights",
}
```

---

## Arguments

This API action does not require any arguments.

---

## Body properties

None.

---

## Effects

- Replaces the `anonymous` and `default` roles and profiles with the objects
  defined in the running Kuzzle instance configuration at `security.standard.roles`
  and `security.standard.profiles`.
- Each role/profile created or replaced is applied with a `{ refresh: "wait_for", userId }` option where `userId` is the caller's kuid.

This action is safe to call multiple times; it will idempotently create or replace
the configured roles and profiles.

---

## Response

Returns `null` on success.

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "restrictDefaultRights",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Usage notes

- Common usage: call this action after creating the first administrator to ensure the public `anonymous` and `default` roles do not expose unintended permissions.
- The roles and profiles applied by this action are fully configurable through the `security.standard` configuration tree. See the configuration guide for details.

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
