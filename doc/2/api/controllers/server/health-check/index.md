---
code: true
type: page
title: healthCheck | API | Core
---

# healthCheck



Returns the status of Kuzzle and it's internal services.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_healthcheck[?services]
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "healthCheck",
  // optional
  "services" : "<services>"
}
```

---

### Optional:

- `services` : You can specify which services you want the status of.(`eg: "storageEngine,memoryStorage"`)


## Response

Returns the status of each services.
- `internalCache` : used by Kuzzle to cache internal data, such as authentication tokens, documents followed by real-time subscriptions, active paginated search queries, API usage statistics or cluster state
- `memoryStorage` : memory cache managed by Kuzzle's [memoryStorage](/core/2/api/controllers/memory-storage) API
- `storageEngine`: Underlying storage layer

The status can either be `green`, `yellow` or `red`.

```js
{
  "status": 200,
  "error": null,
  "action": "healthCheck",
  "controller": "server",
  "collection": null,
  "index": null,
  "volatile": null
  "requestId": "<unique request identifier>",
  "result": {
    "status": "<status>",
      "services": {
        "internalCache" : "<status>",
        "memoryStorage" : "<status>",
        "storageEngine" : "<status>"
      }
}
```
