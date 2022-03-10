---
code: true
type: page
title: capabilities
---

<SinceBadge version="2.17.0"/>

# capabilities


This action should be accessible by all users, the purpose of this action is to inform the client what kind of limits or behavior they should expect from Kuzzle.

_The SDKs are using this action to modify their behavior accordingly to Kuzzle capabilities._


---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_capabilities
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "capabilities"
}
```

---

## Response

Returns the complete Kuzzle capabilities, in JSON format.

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
      "loginsPerSecond": 50,
      "requestsBufferSize": 50000,
      "requestsBufferWarningThreshold": 5000,
      "subscriptionConditionsCount": 100,
      "subscriptionRooms": 1000000,
      "subscriptionDocumentTTL": 259200000
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
      "version": "2.16.6"
  },
  "status": 200,
  "volatile": null
}
```
