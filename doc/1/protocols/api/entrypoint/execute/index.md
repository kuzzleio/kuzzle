---
code: true
type: page
title: execute
---

# execute



Executes a Kuzzle's [API action](/core/1/api/).

The `execute` function main usage is to forward users API requests to Kuzzle.

---

## Arguments

```js
execute(request, [callback]);
```

<br/>

| Arguments  | Type                                                             | Description                                                                                              |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `request`  | [`Request`](/core/1/protocols/api/context/request) | The API query to execute                                                                                 |
| `callback` | <pre>function</pre>                                              | Callback to call with the API execution result.<br/>If not provided, `execute` returns a promise instead |

---

## Return

The `execute` function resolves to an updated Request object, with its [response part](/core/1/protocols/api/context/request) set.

How the response is returned depends whether a callback argument is provided:

- if it is: the `execute` function returns nothing, and the callback is called once the API call is finished, with the following arguments: `callback(error, request)`
- otherwise: the `execute` function returns a promise, resolving to the updated request, or rejected with a KuzzleError object

---

## Example

```js
const request = new context.Request({
  index: 'index',
  collection: 'collection',
  controller: 'document',
  action: 'get',
  _id: 'documentID'
});

try {
  // "request" is the updated Request object
  // The API response is accessed through "request.response"
  request = await context.accessors.execute(request);
} catch (error) {
  // "error" is a KuzzleError object
}
```
