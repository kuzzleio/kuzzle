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
This method can only be used before the application is started, unless the `dynamic` option is set.
:::

```ts
register<TEventDefinition extends EventDefinition = EventDefinition>(
  event: TEventDefinition["name"],
  handler: PipeEventHandler<TEventDefinition>,
  options?: { dynamic?: boolean }
): string | void
```

<br/>

| Argument  | Type                                                                 | Description                                     |
| --------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `event`   | <pre>string</pre>                                                    | Event name                                      |
| `handler` | <pre>[PipeEventHandler](/core/2/framework/types/event-handler)</pre> | Function to execute when the event is triggered |
| `options` | <pre>object</pre>                                                    | Optional options                                |

### options

<SinceBadge version="2.10.2" />

| Property  | Type               | Default | Description                                                         |
| --------- | ------------------ | ------- | ------------------------------------------------------------------- |
| `dynamic` | <pre>boolean</pre> | `false` | Allows to register the pipe once the application is started         |

## Returns

When the pipe is registered once the application is started (with `dynamic: true`), returns the pipe unique identifier, to be used with [unregister](/core/2/framework/classes/backend-pipe/unregister).

Otherwise, returns nothing.

## Errors

- [plugin.runtime.already_started](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is started and the `dynamic` option is not set
- [plugin.assert.invalid_pipe](/core/2/api/errors/error-codes/plugin#subdomain-0x0401-assert): the handler is not a function

## Usage

```js
app.pipe.register('server:afterNow', async (request: KuzzleRequest) => {
  request.result.now = (new Date()).toUTCString();

  return request;
});
```

### Register a pipe once the application is started

```js
const pipeId = app.pipe.register(
  'server:afterNow',
  async (request: KuzzleRequest) => request,
  { dynamic: true });

// Later on
app.pipe.unregister(pipeId);
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