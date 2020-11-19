---
code: false
type: page
title: Customize the API Behavior
description: Use the fine-grained middleware-like system
order: 800
---

# Customize the API Behavior

<!-- Duplicate with guides/develop-on-kuzzle/3-event-system -->

Kuzzle allows to modify API actions behavior with a **very precise middleware-like system**.  

This system makes it possible to **modify the execution flow of requests** processed by Kuzzle.

## Events

Every time a request is executed, **Kuzzle emits several events** to allow changing the life cycle of the processing request.

There are many different events available, you can see the complete list here: [Kuzzle events](/core/2/api/some-link).

### API events

The most frequently used events are those **emitted directly by the API action that is being executed**. Kuzzle emits one event before it starts processing the action, and another one before sending the response back to the client.

The format of those events is the following:
 - `<controller>:before<Action>`: emitted before processing
 - `<controller>:after<Action>`: emitted after processing, before sending back the response

Restarts your application with the following command to display events: `DEBUG=kuzzle:events npm run dev`

::: info
Kuzzle uses the [debug](https://www.npmjs.com/package/debug) package to display messages.  
Learn more about debug messages in the [Debugging Kuzzle](/core/2/debugging) guide.
:::

Then execute the `server:now` action with Kourou: `kourou server:now`

You should see the following lines in your first terminal:
```bash
  [...]

  kuzzle:events Triggering pipe "server:beforeNow" with payload: [ Request { /* ... */ } ] +0ms

  kuzzle:events Triggering pipe "server:afterNow" with payload: [ Request { /* ... */ } ] +1ms

  [...]
```

::: warning
Kuzzle emits many other events during request processing.

Be careful to only use documented events. Some events are for internal use and are subject to change without notice.
:::

## Plugging to events with Pipes

<!-- Duplicate with guides/develop-on-kuzzle/3-event-system -->

Pipes are **functions plugged to events**, called **synchronously** by Kuzzle, and **receiving information** regarding that event.

Pipes can:
  - **Change the received information**. Kuzzle will use the updated information upon resuming the task
  - **Abort a task**. If a pipe throws an error, Kuzzle interrupts the task, and forwards a standardized version of the thrown error to the originating client

![pipe workflow](./pipes-workflow.png)

::: warning
Each event carries a different payload. **This payload must be returned by the pipe function** so Kuzzle can continue its execution process.
:::

### Registering a pipe

<!-- Duplicate with guides/develop-on-kuzzle/3-event-system -->

We need to use the [Backend.pipe.register](/core/2/references/some-link) method to register new pipes. This method takes an event name as its first parameter, followed by the pipe handler function.

In this example, we are going to change the return value of the `server:now` action to make it return a formatted date string instead of a UNIX timestamp:

```js
app.pipe.register('server:afterNow', async (request: Request) => {
  request.result.now = (new Date()).toUTCString()

  return request
})
```

::: info
You can register several pipes on the same action, Kuzzle will execute them sequentially.  
However Kuzzle **provides no guarantee on the pipes execution order**, so pipes should not make assumptions about what other pipes are (or are not) executed before.
:::

Now we can call the action with Kourou:

```bash
kourou server:now

[ℹ] Unknown command "server:now", fallback to API method
 
 🚀 Kourou - Executes an API query.
 
 [ℹ] Connecting to http://localhost:7512 ...
 {
  "now": "Thu, 15 Oct 2020 14:15:27 GMT"
 }
 [✔] Successfully executed "server:now
```

<GuidesLinks
  :prev="{ text: 'Create new Controllers', url: '/guides/getting-started/7-create-new-controllers' }" 
  :next="{ text: 'Deploy your Application', url: '/guides/getting-started/9-deploy-your-application/' }" 
/>
