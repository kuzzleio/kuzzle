---
code: true
type: page
title: register | Framework | Core

description: BackendPipe.register method
---

# `register()`

<SinceBadge version="2.8.0" />

Registers a new pipe on an event.

::: info
This method can only be used before the application is started.
:::

```ts
register(event: string, handler: PipeEventHandler): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Event name |
| `handler` | <pre>[PipeEventHandler](/core/2/framework/types/event-handler)</pre> | Function to execute when the event is triggered |

## Usage

```js
app.pipe.register('server:afterNow', async (request: KuzzleRequest) => {
  request.result.now = (new Date()).toUTCString();

  return request;
});
```

## Strong typing

It's possible to specify the arguments with whom the handler will be called.

This will also ensure that the first argument is returned at the end of the pipe handler.

```js
type EventGenericDocumentAfterWrite = {
  name: 'generic:document:afterWrite';

  args: [Document[], KuzzleRequest];
}

app.pipe.register<EventGenericDocumentAfterWrite>(
  'generic:document:afterWrite',
  async (documents: Document[], request: KuzzleRequest) => {
    app.log.error(documents);

    return documents;
  });
```