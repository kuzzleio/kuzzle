---
code: true
type: page
title: enable | API | Core
---

# enable

Enables the debugger and allows `debug:post`, `debug:addListener` and `debug:removeListener` to be called.
Also prevent the node from being evicted while debugging.
---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/debug/_enable
Method: POST
```

### Other protocols

```js
{
  "controller": "debug",
  "action": "enable",
}
```

## Response


```js
{
  "status": 200,
  "error": null,
  "controller": "debug",
  "action": "enable",
  "requestId": "<unique request identifier>",
}
```
