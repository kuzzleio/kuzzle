---
code: true
type: page
title: post | API | Core
---

# post

Allows you to execute methods from the Debugger using the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) or method from the [Debug Modules](/core/2/api/debug-modules).

---

:::warning
To use the methods from the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) you must enable it in the KuzzleRC at `security.debug.native_debug_protocol`.

Otherwise you will only be able to use the methods from the [Debug Modules](/core/2/api/debug-modules).
:::


## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/debug/_post
Method: POST
Body:
```

```js
{
  "method": "<method name>",
  "params": {
    // ...
  }
}
```

### Other protocols

```js
{
  "controller": "debug",
  "action": "post",
  "body": {
    "method": "<method name>",
    "params": {
      // ...
    }
  }
}
```

## Arguments

- `method`: method name

:::info
When calling methods from [Debug Modules](/core/2/api/debug-modules) you must use the following format `Kuzzle.<module name>.<method name>` for the method name.
:::

### Optional:

- `params`: method parameters

## Response


```js
{
  "status": 200,
  "error": null,
  "controller": "debug",
  "action": "post",
  "requestId": "<unique request identifier>",
  "result": {
    // ...
  }
}
```