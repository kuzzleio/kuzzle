---
code: true
type: page
title: deleteProfile | API | Core
---

# deleteProfile



Deletes a security profile.

An error is returned if the profile is still in use.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_profiles/<_id>[?refresh=wait_for][&onAssignedUsers=remove|fail]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
  "action": "deleteProfile",
  "_id": "<profileId> ",

  // optional arguments
  "onAssignedUsers": "<remove|fail>"
}
```

---

## Arguments

- `_id`: profile identifier

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the profile deletion is indexed (default: `"wait_for"`)
- `onAssignedUsers`: if set to `remove`, Kuzzle will remove this profile from assigned users. If this was a user's sole profile, then the `anonymous` profile will be assigned. (default: `"fail"`) <SinceBadge version="2.4.0" />

---

## Response

Returns the deleted profile identifier.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<profileId>"
  },
  "action": "deleteProfile",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
