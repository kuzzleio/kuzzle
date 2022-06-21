---
code: true
type: page
title: addListener
---

# addListener

Allows you to listen specific events from the [Chrome Devtool Protocol](https://chromedevtools.github.io/devtools-protocol/v8) and Debug Modules. You'll receive a notification when an event is emitted.

---

:::warn
This only works using a Websocket connection since notification can only be sent on a persisted connection.
:::

## Query Syntax

### Websocket protocol

```js
{
  "controller": "debug",
  "action": "addListener",
  "body": {
    "event": "<event name>"
  }
}
```

- `event`: event name to listen to.

::info
If you want to listen to every event emitted you can listen to the event `*`.
:::

## Response


```js
{
  "status": 200,
  "error": null,
  "controller": "debug",
  "action": "addListener",
  "requestId": "<unique request identifier>",
}
```

## Notifications

See [Debugger Notifications](/core/2/api/payloads/notifications).