---
code: true
type: page
title: post
---

# post

Allows you to execute methods from the Debugger using the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) or method from the DebugModules.

---

:::warning
To use the methods from the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) you must enable it in the KuzzleRC at `security.debug.native_debug_protocol`.

Otherwise you will only be able to use the methods from the DebugModules.
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