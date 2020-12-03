---
code: true
type: page
title: use
description: BackendController.use method
---

# `use()`

Loads an API controller class into the application.

::: info
This method can only be used before the application is started.
:::

The controller class must:
 - call the super constructor with the application instance
 - extend the [Controller](/core/2/framework/abstract-classes/controller) abstract class
 - define the `definition` property
 - (optional) define the `name` property

::: info
The controller name will be inferred from the class name in kebab-case unless the `name` property is defined.
(e.g. `PaymentSolutionController` will become `payment-solution`)
:::

```ts
use(controller: Controller): void
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `controller` | <pre>[Controller](/core/2/framework/abstract-classes/controller)</pre> | Controller class extending the [Controller](/core/2/framework/abstract-classes/controller) abstract class |

## Usage

```js
import { Request, Controller } from 'kuzzle'

class EmailController extends Controller {
  constructor (app) {
    super(app)

    this.definition = {
      actions: {
        send: {
          handler: this.send
        }
      }
    }
  }
  async send (request: Request) {
    // ...
  }
}

app.controller.use(new EmailController(app))
```
