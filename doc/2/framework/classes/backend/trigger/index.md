---
code: true
type: page
title: trigger
description: Backend class trigger() method
---

# trigger

<SinceBadge version="change-me" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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
