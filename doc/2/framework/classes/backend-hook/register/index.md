---
code: true
type: page
title: register
description: BackendHook class properties
---

# `register()`

Registers a new hook on an event.

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
| `handler` | <pre>(...args: any) => Promise&lt;any&gt;</pre> | Function to execute when the event is triggered |

**Usage:**

```js
app.pipe.register('request:onError', async (request: Request) => {
  app.log.error(error)
})
```
