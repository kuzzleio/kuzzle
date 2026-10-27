---
code: true
type: page
title: unregister | Framework | Core

description: BackendPipe.unregister method
---

# `unregister()`

<SinceBadge version="2.10.2" />

Removes a pipe registered once the application is started, with the `dynamic` option of [register](/core/2/framework/classes/backend-pipe/register).

::: info
This method can only be used once the application is started.
:::

```ts
unregister(pipeId: string): void
```

<br/>

| Argument | Type              | Description                                                                              |
| -------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `pipeId` | <pre>string</pre> | Pipe identifier returned by [register](/core/2/framework/classes/backend-pipe/register) |

## Errors

- [plugin.runtime.unavailable_before_start](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is not started yet
- [plugin.runtime.unknown_pipe](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): no pipe has this identifier

## Usage

```js
const pipeId = app.pipe.register(
  'server:afterNow',
  async (request: KuzzleRequest) => request,
  { dynamic: true });

app.pipe.unregister(pipeId);
```
