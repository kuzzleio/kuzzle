---
type: page

code: true
title: resetCache | API | Core
---

# resetCache

Asynchronously clears the cache database.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_resetCache?database=[internalCache|memoryStorage]
Method: POST
```

### Other protocols

```js
{
  "database": "internalCache"
}
```

---

## Arguments

- `database`: there are two Redis databases that you can clear
  - `internalCache` : used by Kuzzle to cache internal data, such as authentication tokens, documents followed by real-time subscriptions, active paginated search queries, API usage statistics or cluster state
  - `memoryStorage` : memory cache managed by Kuzzle's [memoryStorage](/core/2/api/controllers/memory-storage) API

---

## Response

Returns a confirmation that the command is being executed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "resetCache",
  "collection": null,
  "index": null,
  "result": { "acknowledge": true }
}
```
