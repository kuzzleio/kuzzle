---
code: true
type: page
title: register
description: BackendHook.register method
---

# `register()`

<SinceBadge version="2.8.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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

## Usage

```js
app.pipe.register('request:onError', async (request: KuzzleRequest) => {
  app.log.error(error)
})
```
