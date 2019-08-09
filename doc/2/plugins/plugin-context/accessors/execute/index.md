---
code: true
type: page
title: execute
---

# execute

Executes a Kuzzle's [API action](/core/2/api).

::: info
This methods does not trigger [API events](/core/2/plugins/guides/events/api-events) or [request:on* events](/core/2/plugins/guides/events/request-on-authorized).
:::

---

## Arguments

```js
execute(request, [callback]);
```

<br/>

| Arguments  | Type                                                           | Description                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `request`  | [`Request`](/core/2/plugins/constructors/request) | The API query to execute                       |
| `callback` | <pre>function</pre>                                            | Callback to call with the API execution result |

---

## Return

The `execute` function resolves to an updated Request object, with its [response part](/core/2/plugins/plugin-context/constructors/request) set.

How the response is returned depends whether a callback argument is provided:

- if it is: the `execute` function returns nothing, and the callback is called once the API call is finished, with the following arguments: `callback(error, request)`
- otherwise: the `execute` function returns a promise, resolving to the updated request, or rejected with a KuzzleError object

---

## Example

```js
const request = new context.constructors.Request({
  index: 'index',
  collection: 'collection',
  controller: 'document',
  action: 'get',
  _id: 'documentID'
});

try {
  // Mutates the provided Request object by updating the response part of
  // it (accessible through the "request.response" property).
  await context.accessors.execute(request);
} catch (error) {
  // "error" is an object inheriting the KuzzleError class
}
```
