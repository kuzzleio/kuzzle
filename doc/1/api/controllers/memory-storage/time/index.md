---
code: true
type: page
title: time
---

# time



Returns the current server time.

[[_Redis documentation_]](https://redis.io/commands/time)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_time
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "time"
}
```

---

## Response

Returns the time as a two items array:

- a timestamp in [Epoch time](https://en.wikipedia.org/wiki/Unix_time)
- the number of microseconds already elapsed in the current second

### Example

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "time",
  "collection": null,
  "index": null,
  "result": [
    "1538640821",
    "450704"
  ]
}
```
