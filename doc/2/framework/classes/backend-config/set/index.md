---
code: true
type: page
title: set
description: BackendConfig.set method
---

# `set()`

Sets a configuration value.

::: info
This method can only be used before application startup.
:::

```ts
set(event: string, handler: (...args: any) => Promise<any>): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `event` | <pre>string</pre> | Path to the configuration key (lodash style) |
| `config` | <pre>any</pre> | Value for the configuration key |

**Usage:**

```js
app.pipe.register('server:afterNow', async (request: Request) => {
  request.result.now = (new Date()).toUTCString()

  return request
})
```
