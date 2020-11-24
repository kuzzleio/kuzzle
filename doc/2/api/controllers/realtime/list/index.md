---
code: true
type: page
title: list
---

# list



Lists subscriptions on all indexes and all collections.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_listSubscriptions
Method: GET
```

### Other protocols

```js
{
  "controller": "realtime",
  "action": "list"
}
```

---

## Response

Returns an object with the following structure:

```js
{
  "<index>": {
    "<collection>": {
      "<subscription identifier": <number of active connections>
    }
  }
}
```

### Example

```js
{
  "error": null,
  "status": 200,
  "index": null,
  "collection": null,
  "controller": "realtime",
  "action": "list",
  "requestId": "<unique request identifier>",
  "result": {
    "<index>": {
      "<collection>": {
        "afcd909773f197ab859447594bfbd154": 12,
        "4adbc1948ac4dc84ac89d14b488bcad1": 4
      },
      "<anotherCollection>": {
        "bcd4ab54cdb4ad5b464ba4cd4564dc46": 1
      }
    },
    "<anotherIndex>": {
      "<yetAnotherCollection>": {
        "5fad4034eed4dc84ac40dc4b48dcdad23": 35
      }
    }
  }
}
```
