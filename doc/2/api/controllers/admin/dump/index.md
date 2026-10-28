---
code: true
type: page
title: dump | API | Core
---

# dump

Creates a snapshot of Kuzzle's state. By default, the request waits for the dump to be complete; with `refresh=false`, it returns immediately while the dump is generated in the background.
Depending on the configuration of Kuzzle, this may include the following:

* a coredump of Kuzzle running process
* the current Kuzzle configuration, secrets masked as in [server:getConfig](/core/2/api/controllers/server/get-config)
* server logs
* Node.js binary & properties (environment variables masked by the same rule)
* a list of OS properties
* plugins configurations
* usage statistics of the dumped instance

The generated directory can be used to feed a complete report to the support team.

::: warning
The coredump holds the whole memory of the Kuzzle process, secrets included, and cannot be masked. Never attach it to a support ticket as-is. See [Securing Redis](/core/2/guides/advanced/configuration#securing-redis).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_dump[?suffix=<suffix>][&refresh=wait_for]
Method: POST
```

### Other protocols

```js
{
  "controller": "admin",
  "action": "dump",

  // optional
  "suffix": "<suffix>",
  "refresh": "wait_for"
}
```

---

## Arguments

### Optional:

* `suffix`: suffix appended to the name of the dump directory (default: `manual-api-action`). At most 64 characters, each one a letter, a digit, `-` or `_`
* `refresh`: if set to `wait_for` (default), Kuzzle responds once the dump is complete. If set to `false`, Kuzzle responds immediately; errors raised by the dump are then only written to the logs

---

## Response

Returns an acknowledgement.

```javascript
{
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "dump",
  "result": {
    "acknowledge": true
  }
}
```

---

## Possible errors

The two errors below are returned only with `refresh=wait_for` (with `refresh=false`, they are written to the logs):

- [Common errors](/core/2/api/errors/types#common-errors)
- [BadRequestError](/core/2/api/errors/types#badrequesterror): invalid `suffix` (`api.assert.invalid_argument`)
- [PreconditionError](/core/2/api/errors/types#preconditionerror): a dump is already being generated on this node (`api.process.action_locked`)
