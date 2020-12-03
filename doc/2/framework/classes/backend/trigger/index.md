---
code: true
type: page
title: trigger
description: Backend class trigger() method
---

# trigger

Triggers an event.

::: warning
If an internal event is triggered, the payload must be the same as the one usually expected.
:::

```ts
trigger (event: string, ...payload): Promise<any>
```

<br/>

## Returns

Returns a Promise resolving to the pipe chain result.

## Usage

```js
await app.trigger('prometheus:start-metrics')
```
