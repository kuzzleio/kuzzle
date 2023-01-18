---
code: true
type: page
title: getConfig | API | Core
---

# getConfig



Returns the current Kuzzle configuration.

This route should only be accessible to administrators, as it might return sensitive information about the backend.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_getConfig
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "getConfig"
}
```

---

## Response

Returns the complete Kuzzle configuration, in JSON format.

```js
{
  "status": 200,
  "error": null,
  "action": "getConfig",
  "controller": "server",
  "result": {
    "limits": {
      "concurrentRequests": 100,
      "documentsFetchCount": 10000,
      "documentsWriteCount": 200,
      "requestsBufferSize": 50000,
      "requestsBufferWarningThreshold": 5000,
      "subscriptionConditionsCount": 16,
      "subscriptionMinterms": 0,
      "subscriptionRooms": 1000000,
      "subscriptionDocumentTTL": 259200
    },
    "plugins": {
      "common": {
        "bootstrapLockTimeout": 5000,
        "pipeWarnTime": 500,
        "pipeTimeout": 5000,
        "initTimeout": 10000
      }
    },
    // ... etc ...
    "version": "1.5.1"
  }
}
```
