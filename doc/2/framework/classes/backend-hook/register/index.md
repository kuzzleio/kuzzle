---
code: true
type: page
title: register
description: BackendHook.register method
---

# `register()`

<SinceBadge version="2.8.0" />

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
app.hook.register('request:onError', async (request: KuzzleRequest) => {
  app.log.error(error)
});
```

## Strong typing

It's possible to specify the arguments with whom the handler will be called.

```js
app.hook.register<[Document[], KuzzleRequest]>(
  'generic:document:afterWrite',
  async (documents: Document[], request: KuzzleRequest) => {
    app.log.error(documents)
  }),
```