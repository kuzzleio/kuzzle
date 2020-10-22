---
code: false
type: page
title: Create new Controllers
description: Extends Kuzzle API with new actions
order: 600
---

# Create new Controllers

The Kuzzle API is composed of **actions grouped in controllers**.  
A controller is a logical container that groups several actions together.

Each action receives a [Request object](/core/2/some-link) in parameter and is in charge of returning a result which will be transmitted in the response.

## Register a new Controller

We are going to modify the `app.ts` file to register a controller to expose new API actions.

For this, we need to use the [Backend.controller.register](/core/2/some-link) method.

This method takes the controller name and a [ControllerDefinition](/core/2/api/some-link) which defines the controller actions:

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})
```

The code above will register a `greeting` controller with a `sayHello` action.  
This action uses the `name` argument from the request and returns a string.  

::: info
Kuzzle will generate a default HTTP route of the following format if none is provided:   
`GET /_/<controller-name>/<action-name>`  
Controller name and action name will be converted to `kebab-case`.  
See our in-depth guide to learn how to declare your own HTTP routes: [Registering and using controllers](/core/2/some-link)
:::

We can now test our new action:

:::: tabs
::: tab Kourou

```bash
$ kourou greeting:sayHello --arg name=Yagmur
[ℹ] Unknown command "greeting:sayHello", fallback to API method
 
 🚀 Kourou - Executes an API query.
 
 [ℹ] Connecting to http://localhost:7512 ...
 "Hello, Yagmur"
 [✔] Successfully executed "greeting:sayHello"
```

:::
::: tab HTTP

```bash
$ curl "http://localhost:7512/_/greeting/say-hello?name=Yagmur&pretty"
{
  "requestId": "383e016a-447e-4138-aa53-c07c9fd5c923",
  "status": 200,
  "error": null,
  "controller": "greeting",
  "action": "sayHello",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": "Hello, Yagmur"
}
```

:::
::: tab WebSocket

```js
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'

{"requestId":"a6f4f5b6-1aa2-4cf9-9724-12b12575c047","status":200,"error":null,"controller":"greeting","action":"sayHello","collection":null,"index":null,"volatile":null,"result":"Hello, Yagmur","room":"a6f4f5b6-1aa2-4cf9-9724-12b12575c047"}
```

:::
::::


Learn more about:
 - [Registering and using controllers](/core/2/some-link)
 - [API Request and Response format](/core/2/some-link)

::: info
Next guide :arrow_forward: [Customize API Behavior](/core/2/guides/getting-started/7-customize-api-behavior/)
:::
