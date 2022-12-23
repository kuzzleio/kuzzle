---
code: false
type: page
title: ControllerDefinition | Framework | Core

description: ControllerDefinition type definition
---

# ControllerDefinition

<SinceBadge version="2.8.0" />

The `ControllerDefinition` type is used to define new controllers.

This type can be found as the second argument of the [Backend.controller.use](/core/2/framework/classes/backend-controller/use) method or as the [Controller.definition](/core/2/framework/abstract-classes/controller/properties) property.

<<< ./../../../../../lib/types/ControllerDefinition.ts

**Example:**

```js
import { ControllerDefinition, KuzzleRequest } from 'kuzzle';

const definition: ControllerDefinition = {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => 'Hello',
      http: [{
        verb: 'post',
        path: 'greeting/sayHello',
        openapi: {
          description: "Simply say hello",
          responses: {
            200: {
              content: {
                "application/json": {
                  schema: {
                    type: "string",
                  }
                }
              }
            }
          }
        }
      }],
    }
  }
};
```
