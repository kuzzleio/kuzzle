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
register(event: string, handler: ClusterEventHandler): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `handler` | <pre>[ClusterEventHandler](/core/2/framework/types/event-handler)</pre> | Function to execute when the event is triggered |

## Usage

```js
app.hook.register('request:onError', (request: KuzzleRequest) => {
  app.log.error(error)
});
```

## Strong typing

It's possible to specify the arguments with whom the handler will be called.

```js
type EventGenericDocumentAfterWrite = {
  name: 'generic:document:afterWrite';

  args: [Document[], KuzzleRequest];
}

app.hook.register<EventGenericDocumentAfterWrite>(
  'generic:document:afterWrite',
  async (documents: Document[], request: KuzzleRequest) => {
    app.log.error(documents);
  });
```