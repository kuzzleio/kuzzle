---
code: false
type: page
title: API Controllers
description: Extend Kuzzle API with controllers and actions
order: 200
---

# API Controllers

Kuzzle allows to extend its existing API using Controllers. Controllers are **logical containers of actions**.  

These actions are then **processed like any other API action** and can be executed through the different mechanisms to secure and normalize requests.

## Add a new Controller

Each controller can therefore have several actions. Each of these **actions is associated with a function** called [handler](/core/2/guides/develop-on-kuzzle/2-api-controllers#action-handler).

::: info
The syntax of the definition of these actions and the associated handlers is defined by the [ControllerDefinition](/core/2/some-link) interface.  
:::

By convention, a controller action is identified with the name of the controller followed by the action separated by a colon: `<controller>:<action>` (e.g. [document:create](/core/2/api/controllers/document/create)).

::: warning
Controllers must be added to the application before the application is started with the [Backend.start](/core/2/some-link) method.
:::

We have chosen to allow developers to add controllers in two different ways in order to best adapt to their needs.  

These two ways are very similar and achieve the same goal.  

### Register a Controller

The [Backend.controller.register](/core/2/some-link) method allows to add a new controller using a **Plain Old Javascript Object (POJO) complying with the [ControllerDefinition](/core/2/some-link) interface**.  

This method takes in parameter the **name** of the controller followed by its **definition**:

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => /* ... */
    },
    sayGoodbye: {
      handler: async request => /* ... */
    },
  }
})
```

This is faster to develop but maintenance can be costly in the long run for larger applications with many controllers and actions.

### Use a Controller class

The [Backend.controller.use](/core/2/some-link) method allows to add a new controller using a **class inheriting from the [Controller](/core/2/some-link) class**.  

This class must respect the following conventions:
 - extend the `Controller` class
 - call the super constructor with the application instance
 - define the controller actions under the `definition` property

::: info
The controller name will be inferred from the class name (unless the `name` property is defined). E.g. `PaymentSolutionController` will become `payment-solution`.
:::

```js
import { Controller } from 'kuzzle'

class GreetingController extends Controller {
  constructor (app: Backend) {
    super(app);

    // type ControllerDefinition
    this.definition = {
      actions: {
        sayHello: {
          handler: this.sayHello
        },
        sayGoodbye: {
          handler: this.sayGoodbye
        }
      }
    }
  }

  async sayHello (request: Request) { /* ... */ }

  async sayGoodbye (request: Request) { /* ... */ }
}
```

Once you have defined your controller class, you can instantiate it and pass it to the `Backend.controller.use` method:

```js
const greetingController = new GreetingController(app)

app.controller.use(greetingController)
```

This way of doing things takes longer to develop but it allows you to have a better code architecture while respecting OOP concepts.

## Handler Function

The handler is the function that will **be called each time our API action is executed**.

This function **takes a [Request object](/core/2/some-link)** as a parameter and **must return a Promise** resolving on the result to be returned to the client.

This function is defined in the `handler` property of an action. Its signature is: `(request: Request) => Promise<any>`.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      // Handler function for the "greeting:sayHello" action
      handler: async (request: Request) => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})
```

The result returned by our `handler` will be **converted to JSON format** and integrated into the standard Kuzzle response in the `result` property.

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'

{
  "requestId": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047",
  "status": 200,
  "error": null,
  "controller": "greeting",
  "action": "sayHello",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": "Hello, Yagmur", # <= handler function return value
  "room": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047"
}
```

## HTTP routes

The execution of an API action through the HTTP protocol is significantly different from other protocols.  

Indeed, **the HTTP protocol uses verbs and routes** in order to address an action whereas the other protocols only use the controller and action name in their JSON payloads.

### Define a HTTP route

When defining a controller action, it is also possible to **specify one or more HTTP routes** available to execute our action using the `http` property.

This property is at the same level as `handler` and **represents an array of routes**.  
Each route is an object containing a `verb` and a `path` property.

The following HTTP verbs are available: `get`, `post`, `put`, `delete`, `head`.

::: info
When the `path` property starts with a `/` then the route is added as is, otherwise the route will be prefixed with `/_/`.
:::

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        return `Hello, ${request.input.args.name}`
      },
      http: [
        // generated route: "GET http://<host>:<port>/greeting/hello"
        { verb: 'get', path: '/greeting/hello' },
        // generated route: "POST http://<host>:<port>/_/hello/world"
        { verb: 'post', path: 'hello/world' },
      ]
    }
  }
})
```

::: warning
It is recommended to let Kuzzle prefix the routes with `/_/` in order to avoid conflict with the existing routes of the standard API.
:::

It is possible to define paths with url parameters. These parameters will be captured and then integrated into the [Request Input](/core/2/guides/develop-on-kuzzle/2-api-controllers#request-input).

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        // "name" comes from the url parameter
        return `Hello, ${request.input.args.name}`
      },
      http: [
        { verb: 'get', path: '/email/send/:name' },
      ]
    }
  }
})
```

### Default route

If the `http` property is not set, then Kuzzle will **generate a default route** so that the action can be called from the HTTP protocol.

This default generated route has the following format: `GET http://<host>:<port>/_/<controller-name>/<action-name>`.

The name of the controller and the action will be converted to `kebab-case` format.  
For example the default route of the `sayHello` action will be: `GET http://<host>:<port>/_/greeting/say-hello`.

::: info
It is possible to prevent the generation of a default HTTP route by providing an empty array to the `http` property.  
By doing this, **the action will not be available through the HTTP protocol**.
:::

## Request Input

The `handler` of an API action receives an instance of [Request object](/core/2/some-link). This object represents an API request and **contains both the client input and client contextual information**.

The arguments of requests sent to the Kuzzle API are available in the [Request.input](/core/2/some-link) property.

The main available properties are the following:
 - `controller`: API controller name
 - `action`: API action name
 - `resource`: Kuzzle specifics arguments (`_id`, `index` and `collection`)
 - `args`: additional arguments
 - `body`: body content

### HTTP

With HTTP, there are 3 types of input parameters:
 - URL parameters (__e.g. `/greeting/hello/:name`__)
 - Query arguments (__e.g. `/greeting/hello?name=aschen`__)
 - Request body

URL parameters and query arguments can be found in the `request.input.args` property **unless it is a Kuzzle specific argument** (`_id`, `index` and `collection`), in that case they can be found in the `request.input.resource` property.

The content of the query body can be found in the `request.input.body` property 

::: info
The request body must either be in JSON format or submitted as an HTTP form (URL encoded or multipart form data)
:::

For example, with the following request input:

```bash
# Route: "POST /greeting/hello/:name" 
$ curl \
  -X POST \
  -H  "Content-Type: application/json" \
  "localhost:7512/_/greeting/hello/aschen?_id=JkkZN62jLSA&age=27" \
  --data '{
    "city" : "Antalya" 
  }'
```

We can retrieve them in the [Request object](/core/2/some-link) passed to the `handler`:

```js
import assert from 'assert'

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        assert(request.input.resource._id === 'JkkZN62jLSA')
        assert(request.input.args.name === 'aschen')
        assert(request.input.args.age === '27')
        assert(request.input.body.city === 'Antalya')
      },
      http: [
        { verb: 'POST', path: 'greeting/hello/:name' }
      ]
    }
  }
})
```

::: info
See the [Request Payload](/core/2/api/essentials/query-syntax#http) page for more information about using the API with HTTP.
::: 

### Other protocols

Other protocols directly **use JSON payloads**.  

These payloads contain all the information directly:

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "_id": "JkkZN62jLSA",
  "age": 27,
  "name": "aschen",
  "body": {
    "city": "Antalya"
  }
}'
```

We can retrieve them in the [Request object](/core/2/some-link) passed to the `handler`:

```js
import assert from 'assert'

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        assert(request.input.resource._id === 'JkkZN62jLSA')
        assert(request.input.args.name === 'aschen')
        assert(request.input.args.age === '27')
        assert(request.input.body.city === 'Antalya')
      },
    }
  }
})
```

::: warning
`_id`, `index` and `collection` are **specific Kuzzle inputs** and are available in the `request.input.resource` property.
:::

::: info
See the [Request Payload](/core/2/api/essentials/query-syntax#other-protocols) page for more information about using the API with other protocols.
::: 


## Request Context

Information about **the client that executes an API action** are available in the [Request.context](/core/2/some-link) property.

The available properties are as follows:
 - [connection](/core/2/some-link): information about the connection
 - [user](/core/2/some-link): information about the user executing the request
 - (optional) [token](/core/2/some-link): information about the authentication token

Example:
```js
import assert from 'assert'

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        // Unauthenticated users are anonymous 
        // and the anonymous user ID is "-1"
        assert(request.context.user._id === '-1')
        assert(request.context.connection.protocol === 'http')
      },
    }
  }
})
```

::: info
More informations about the [RequestContext](/core/2/some-link) class properties.
:::

## Response format

Kuzzle Response are **standardized**. This format is shared by all API actions, including custom controller actions.

A Kuzzle Response is a **JSON object** with the following format:

| Property     | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `action`     | API action                                                                          |
| `collection` | Collection name, or `null` if no collection was involved                                       |
| `controller` | API controller                                                                             |
| `error`      | [KuzzleError](/core/2/api/essentials/error-handling) object, or `null` if there was no error                |
| `index`      | Index name, or `null` if no index was involved                                                 |
| `requestId`  | Request unique identifier                                                                           |
| `result`     | Action result, or `null` if an error occured                                                         |
| `status`     | Response status, using [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) |
| `volatile`   | Arbitrary data repeated from the initial request                                                    |
The `result` property will contain the return of the action `handler` function.

For example, when calling this controller action:
```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})
```

The following response will be sent:

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'

{
  "requestId": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047",
  "status": 200,
  "error": null,
  "controller": "greeting",
  "action": "sayHello",
  "collection": null,
  "index": null,
  "volatile": null,
  "result": "Hello, Yagmur", # <= handler function return value
  "room": "a6f4f5b6-1aa2-4cf9-9724-12b12575c047"
}
```

#### Return a custom response

In some cases it may be necessary to **return a response that differs** from the standard API response format.

This may be to send a **smaller JSON response** for constrained environments, to **perform HTTP redirection** or to **return another MIME type** such as CSV, an image, a PDF document, etc.

For this it is possible to use the method [Request.setResult](/core/2/some-lin) with the `raw` option set to true. This option prevents Kuzzle from standardizing an action's output:

```js
app.controller.register('files', {
  actions: {
    csv: {
      handler: async request => {
        const csv = 'name,age\naschen,27\ncaner,28\n'

        request.setResult(null, {
          headers: {
            'content-type': 'text/csv'
          },
          raw: true
        })

        return csv
      }
    }
  }
})
```

The response will only contain the CSV document:

```bash
$ curl localhost:7512/_/files/csv

name,age
aschen,27
caner,28
```

## Use a custom Controller Action

As we have seen, controller actions can be executed via different protocols.

We will explore the various possibilities available to execute API actions.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: Request) => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})
```

### HTTP

To execute our action through HTTP protocol CURL can be used:

```bash
$ curl http://localhost:7512/_/greeting/say-hello?name=Yagmur
```

::: info
Default generated route uses `GET` verb.  
It is therefore possible to open it directly in a browser: [http://localhost:7512/_/greeting/say-hello?name=Yagmur](http://localhost:7512/_/greeting/say-hello?name=Yagmur)
:::

### WebSocket

To execute an action through the WebSocket protocol [wscat](https://www.npmjs.com/package/wscat) can be used:

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'
```

### Kourou

From a terminal [Kourou](/core/2/some-link), the Kuzzle CLI, can be used to execute an action:

```bash
$ kourou greeting:sayHello --arg name=Yagmur
```

It is possible to pass multiple arguments by repeating the `--arg <arg>=<value>` flag or specify a body with the `--body '{}'` flag.  

::: info
More info about [Kourou](/core/2/some-link).
:::

### SDK

From one of the [SDKs](/sdk), it is possible to use the `query` method which takes as parameter a [Request Payload](/core/2/some-link).  

:::: tabs
::: Javascript

Using the Javascript SDK [Kuzzle.query](/sdk/js/7/core-classes/kuzzle/query) method:

```js
const response = await kuzzle.query({
  controller: 'greeting',
  action: 'sayHello',
  name: 'Yagmur'
})
```

:::

::: Dart

Using the Dart SDK [Kuzzle.query](/sdk/dart/2/core-classes/kuzzle/query) method:

```dart
final response = await kuzzle.query({
  'controller': 'greeting',
  'action': 'sayHello',
  'name': 'Yagmur'
});
```

:::
::::


## Allow access to a custom Controller Action

In the rights management system, **[roles](/core/2/some-link) are managing access to API actions**.  

They operate on a whitelist principle by **listing the controllers and actions they have access to**.

So, to allow access to the `greeting:sayHello` action, the following role can be written:

```bash
$ kourou security:createRole '{
  controllers: {
    greeting: {
      actions: {
        sayHello: true
      }
    }
  }
}' --id steward
```

It is also possible to use a wildcard (`*`) to give access to all the actions of a controller:

```bash
$ kourou security:createRole '{
  controllers: {
    greeting: {
      actions: {
        "*": true
      }
    }
  }
}' --id steward
```

::: info
More info about [Permissions](/core/2/some-link)
:::