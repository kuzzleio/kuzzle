---
code: true
type: page
title: trigger | Framework | Core

description: Backend class trigger() method
---

# trigger

<SinceBadge version="2.8.0" />

Triggers an event.

::: warning
If an internal event is triggered, the payload must be the same as the one usually expected.
:::

::: info
This method can only be used once the application is started.
:::

```ts
trigger<TEventDefinition extends EventDefinition = EventDefinition>(
  event: TEventDefinition["name"],
  ...payload: TEventDefinition["args"]
): Promise<TEventDefinition["args"][0]>
```

<br/>

## Returns

Returns a Promise resolving to the pipe chain result.

## Errors

- [plugin.runtime.unavailable_before_start](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is not started yet

## Usage

```js
await app.trigger('prometheus:start-metrics')
```
