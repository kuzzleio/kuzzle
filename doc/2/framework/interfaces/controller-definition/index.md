---
code: false
type: page
title: ControllerDefinition
description: ControllerDefinition interface definition
---

# ControllerDefinition

The `ControllerDefinition` interface is used to define new controllers.  

This type can be found as the second argument of the [Backend.controller.use](/core/2/framework/some-link) method or as the [Controller.definition](/core/2/framework/some-link) property.

<<< ./../../../../../lib/types/ControllerDefinition.ts

**Example:**

```js
import { ControllerDefinition, Request } from 'kuzzle';

const definition: ControllerDefinition = {
  actions: {
    sayHello: {
      handler: async (request: Request) => 'Hello',
      http: [
        { verb: 'post', path: 'greeting/sayHello' }
      ]
    }
  }
};
```
