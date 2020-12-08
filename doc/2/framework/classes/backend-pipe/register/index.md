---
code: true
type: page
title: register
description: BackendPipe.register method
---

# `register()`

<SinceBadge version="change-me" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Registers a new pipe on an event.

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

## Usage

```js
app.pipe.register('server:afterNow', async (request: KuzzleRequest) => {
  request.result.now = (new Date()).toUTCString()

  return request
})
```
