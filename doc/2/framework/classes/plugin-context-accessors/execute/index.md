---
code: true
type: page
title: execute
description: PluginContextAccessors class execute() method
---

# execute

Executes a Kuzzle's [API action](/core/2/api).

::: info
This methods does not trigger [API events](/core/2/framework/events/api) or [request:on* events](/core/2/plugins/guides/events/request-on-authorized).
:::

## Arguments

```ts
execute(request: Request, callback?: any): Promise<Request>;
```

<br/>

| Arguments  | Type                                                           | Description                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `request`  | [Request](/core/2/framework/classes/request) | The API action to execute                       |
| `callback` | <pre>function</pre>                                            | Callback to call with the API execution result <DeprecatedBadge version="change-me"/> |

---

## Return

The `execute` function resolves to an updated Request object, with its [response part](/core/2/framework/classes/request-response) set.

How the response is returned depends whether a callback argument is provided:

- if it is: the `execute` function returns nothing, and the callback is called once the API call is finished, with the following arguments: `callback(error, request)`
- otherwise: the `execute` function returns a promise, resolving to the updated request, or rejected with a KuzzleError object

---

## Example

```ts
import { Request } from 'kuzzle'

const request = new Request({
  index: 'index',
  collection: 'collection',
  controller: 'document',
  action: 'get',
  _id: 'documentID'
})

// Mutates the provided Request object by updating its response part
// (accessible through the "request.response" property).
await context.accessors.execute(request)
```
