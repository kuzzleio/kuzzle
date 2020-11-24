---
code: true
type: page
title: register
description: BackendPipe.register method
---

# `register()`

Registers a new pipe on an event.

::: info
This method can only be used before application startup.
:::

```ts
register(event: string, handler: (...args: any) => Promise<any>): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `config` | <pre>(...args: any) => Promise<any></pre> | Function to execute when the event is triggered |

**Usage:**

```js
app.pipe.register('server:afterNow', async (request: Request) => {
  request.result.now = (new Date()).toUTCString()

  return request
})
```
