---
code: true
type: page
title: register
description: BackendController.register method
---

# `register()`

<SinceBadge version="2.8.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Registers a new API controller on the fly.

::: info
This method can only be used before the application is started.
:::

```ts
register(name: string, definition: ControllerDefinition): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `name` | <pre>string</pre> | Controller name |
| `handler` | <pre>[ControllerDefinition](/core/2/framework/types/controller-definition)</pre> | Controller actions definition |

## Usage

```js
import { KuzzleRequest } from 'kuzzle'

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => `Hello, ${request.input.args.name}`,
      http: [{ verb: 'post', path: 'greeting/hello/:name' }]
    }
  }
})
```
