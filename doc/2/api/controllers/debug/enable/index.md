---
code: true
type: page
title: enable
---

# enable

Enable the debugger and allows to call `debug:post`, `debug:addListener`, `debug:removeListener`.

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
