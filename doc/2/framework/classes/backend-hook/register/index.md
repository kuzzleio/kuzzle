---
code: true
type: page
title: register
description: BackendHook.register method
---

# `register()`

Registers a new hook on an event.

::: info
This method can only be used before the application is started.
:::

```ts
register(event: string, handler: EventHandler): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `handler` | <pre>[EventHandler](/core/2/framework/types/event-handler)</pre> | Function to execute when the event is triggered |

**Usage:**

```js
app.pipe.register('request:onError', async (request: Request) => {
  app.log.error(error)
})
```
