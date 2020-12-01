---
code: true
type: page
title: execute
---

# execute



Executes a Kuzzle's [API action](/core/2/api).

The `execute` function main usage is to forward users API requests to Kuzzle. 

---

## Arguments

```js
execute(request, [callback]);
```

<br/>

| Arguments  | Type                                                             | Description                                                                                              |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `request`  | <pre>[Request](/core/2/guides/write-protocols/2-context/request)</pre> | Standardized API request |
| `callback(result)` | <pre>function</pre> | Callback receiving the response |

---

## Return

The `execute` function resolves to a serialized Kuzzle response JSON object.

This resulting object contains the following properties:

* `raw` (boolean, default `false`): if `false`, the response content is a JSON object following the [Kuzzle standard response format](core/1/api/essentials/kuzzle-response). Otherwise, the content can be anything, depending on the executed API action.
* `status` (integer, default `200`): request status, following the standard [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes)
* `requestId` (string, nullable): request identifier set by clients, and used to link asynchronous responses to emitted requests.
* `content`: the response itself, this is the payload that should be sent to the requesting client following the implemented protocol format. This property type partly depends on the value of the `raw` flag (if `false`, then the content is always a JSON object).
* `headers` (JSON object, default `{}`): custom headers/optional response properties that can be added by the executed API action. Whether the protocol interprets and uses them depends on its nature and implementation.

---

## Example

```js
const request = new context.Request({
  controller: 'server',
  action: 'now'
});

context.accessors.execute(request, result => {
  // Content example for the result object:
  // 
  // { 
  //   "raw": false,
  //   "status": 200,
  //   "requestId": "b0eec0b9-f458-4ec8-8aee-b86d7a922290",
  //   "content": { 
  //     "requestId": "b0eec0b9-f458-4ec8-8aee-b86d7a922290",
  //     "status": 200,
  //     "error": null,
  //     "controller": "server",
  //     "action": "now",
  //     "collection": null,
  //     "index": null,
  //     "volatile": null,
  //     "result": { "now": 1564644834036 } 
  //   },
  //   "headers": { 
  //     "content-type": "application/json",
  //     "Accept-Encoding": "gzip,deflate,identity",
  //     "Access-Control-Allow-Origin": "*",
  //     "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,HEAD"
  //   } 
  // }
});
```
