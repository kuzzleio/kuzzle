---
code: true
type: page
title: getArrayOrCsv | Framework | Core

description: KuzzleRequest class getArrayOrCsv() method
---

# getArrayOrCsv

<SinceBadge version="auto" />

Gets a parameter from the request arguments as an array, also accepting a comma-separated string.

This is the form the API documents for the `ids` argument of [document:mGet](/core/2/api/controllers/document/m-get), [document:mExists](/core/2/api/controllers/document/m-exists) and [security:mGetUsers](/core/2/api/controllers/security/m-get-users), and for the `services` argument of [server:healthCheck](/core/2/api/controllers/server/health-check).

- an array is returned as is;
- a string is, with the HTTP protocol only, first parsed as a JSON array (the way to pass an element containing a comma), and otherwise split on `,` whatever the protocol.

Unlike [getArray](/core/2/framework/classes/kuzzle-request/get-array), a single value such as `?ids=foo` is returned as `["foo"]`.

### Arguments

```ts
getArrayOrCsv (name: string, def: [] = null): any[]
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>array</pre> | Default value to return if the parameter is not set |


### Example

```ts
// GET /_healthcheck?services=storageEngine,memoryStorage
const services = request.getArrayOrCsv('services');
// ["storageEngine", "memoryStorage"]
```
