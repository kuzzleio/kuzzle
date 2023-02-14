---
code: true
type: page
title: disable | API | Core
---

# disable

Disable the debugger and prevent calls to `debug:post`, `debug:addListener`, `debug:removeListener`.
While ending the debugging session it allows the node to be evicted again.
---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/debug/_disable
Method: POST
```

### Other protocols

```js
{
  "controller": "debug",
  "action": "disable",
}
```

## Response


```js
{
  "status": 200,
  "error": null,
  "controller": "debug",
  "action": "disable",
  "requestId": "<unique request identifier>",
}
```
