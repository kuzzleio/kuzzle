---
code: false
type: page
title: API Controllers
description: Extend Kuzzle API with controllers and actions
order: 300
---

# API Controllers

Kuzzle allows to extend its existing API using Controllers. Controllers are **logical containers of actions**.  

These actions are then **processed like any other API action** and can be executed through the different mechanisms to secure and normalize requests.

## Add a new Controller

Each controller can therefore have several actions. Each of these **actions is associated with a function** called [handler](/core/2/guides/develop-on-kuzzle/api-controllers#handler-function).

::: info
The syntax of the definition of these actions and the associated handlers is defined by the [ControllerDefinition](/core/2/framework/types/controller-definition) interface.  
:::

By convention, a controller action is identified with the name of the controller followed by the action separated by a colon: `<controller>:<action>` (e.g. [document:create](/core/2/api/controllers/document/create)).

::: warning
Controllers must be added to the application before the application is started with the [Backend.start](/core/2/framework/classes/backend/start) method.
:::

We have chosen to allow developers to add controllers in two different ways in order to best adapt to their needs.  

These two ways are very similar and achieve the same goal.  

### Register a Controller

The [Backend.controller.register](/core/2/framework/classes/backend-controller/register) method allows to add a new controller using a **Plain Old Javascript Object (POJO) complying with the [ControllerDefinition](/core/2/framework/types/controller-definition) interface**.  

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
});
```

This is faster to develop but maintenance can be costly in the long run for larger applications with many controllers and actions.

### Use a Controller class

The [Backend.controller.use](/core/2/framework/classes/backend-controller/use) method allows to add a new controller using a **class inheriting from the [Controller](/core/2/framework/abstract-classes/controller) class**.  

This class must respect the following conventions:
 - extend the `Controller` class
 - call the super constructor with the application instance
 - define the controller actions under the `definition` property

::: info
The controller name will be inferred from the class name (unless the `name` property is defined). E.g. `PaymentSolutionController` will become `payment-solution`.
:::

```js
import { Controller, KuzzleRequest } from 'kuzzle';

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
    };
  }

  async sayHello (request: KuzzleRequest) { /* ... */ }

  async sayGoodbye (request: KuzzleRequest) { /* ... */ }
}
```

::: info
If the handler function is an instance method of the controller then the context will be automatically bound to the controller instance.
:::

Once you have defined your controller class, you can instantiate it and pass it to the `Backend.controller.use` method:

```js
const greetingController = new GreetingController(app);

app.controller.use(greetingController);
```

This way of doing things takes longer to develop but it allows you to have a better code architecture while respecting OOP concepts.

## Handler Function

The handler is the function that will **be called each time our API action is executed**.

This function **takes a [KuzzleRequest](/core/2/framework/classes/kuzzle-request) object** as a parameter and **must return a Promise** resolving on the result to be returned to the client.

This function is defined in the `handler` property of an action. Its signature is: `(request: KuzzleRequest) => Promise<any>`.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      // Handler function for the "greeting:sayHello" action
      handler: async (request: KuzzleRequest) => {
        return `Hello, ${request.getString('name')}`;
      }
    }
  }
});
```

The result returned by our `handler` will be **converted to JSON format** and integrated into the standard Kuzzle response in the `result` property.

```bash
npx wscat -c ws://localhost:7512 --execute '{
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
      handler: async (request: KuzzleRequest) => {
        return `Hello, ${request.getString('name')}`;
      },
      http: [
        // generated route: "GET http://<host>:<port>/greeting/hello"
        { verb: 'get', path: '/greeting/hello' },
        // generated route: "POST http://<host>:<port>/_/hello/world"
        { verb: 'post', path: 'hello/world' },
      ]
    }
  }
});
```

::: warning
It is recommended to let Kuzzle prefix the routes with `/_/` in order to avoid conflict with the existing routes of the standard API.
:::

It is possible to define paths with url parameters. These parameters will be captured and then integrated into the [KuzzleRequest Input](/core/2/guides/develop-on-kuzzle/api-controllers#request-input).

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        // "name" comes from the url parameter
        return `Hello, ${request.getString('name')}`;
      },
      http: [
        { verb: 'get', path: '/email/send/:name' },
      ]
    }
  }
});
```

### Default route

If the `http` property is not set, then Kuzzle will **generate a default route** so that the action can be called from the HTTP protocol.

This default generated route has the following format: `GET http://<host>:<port>/_/<controller-name>/<action-name>`.

The name of the controller and the action will be converted to `kebab-case` format.  
For example the default route of the `sayHello` action will be: `GET http://<host>:<port>/_/greeting/say-hello`.

::: info
It is possible to prevent the generation of a default HTTP route by providing an empty array to the `http` property.  
By doing this, the action will only be available through the HTTP protocol with the [JSON Query Endpoint](/core/2/guides/main-concepts/api#json-query-endpoint).
:::

## KuzzleRequest Input

The `handler` of an API action receives an instance of [KuzzleRequest](/core/2/framework/classes/kuzzle-request) object. This object represents an API request and **contains both the client input and client contextual information**.

The arguments of requests sent to the Kuzzle API are available in the [KuzzleRequest.input](/core/2/framework/classes/request-input) property.

The main available properties are the following:
 - `controller`: API controller name
 - `action`: API action name
 - `args`: Action arguments
 - `body`: Body content

### Extract parameters from request

<SinceBadge version="auto-version" />

The request object exposes methods to safely extract parameters from the request in a standardized way.

Each of those methods will check for the parameter presence and type. In case of a validation failure, the corresponding API error will be thrown.

All those methods start with `getXX`: [getString](/core/2/framework/classes/kuzzle-request/get-string), [getBoolean](/core/2/framework/classes/kuzzle-request/get-boolean), [getBodyObject](/core/2/framework/classes/kuzzle-request/get-body-object) etc. 

### HTTP

With HTTP, there are 3 types of input parameters:
 - URL parameters (__e.g. `/greeting/hello/:name`__)
 - Query arguments (__e.g. `/greeting/hello?name=aschen`__)
 - KuzzleRequest body

URL parameters and query arguments can be found in the `request.input.args` property.

The content of the query body can be found in the `request.input.body` property 

::: info
The request body must either be in JSON format or submitted as an HTTP form (URL encoded or multipart form data)
:::

For example, with the following request input:

```bash
# Route: "POST /greeting/hello/:name" 
curl \
  -X POST \
  -H  "Content-Type: application/json" \
  "localhost:7512/_/greeting/hello/aschen?_id=JkkZN62jLSA&age=27" \
  --data '{
    "city" : "Antalya" 
  }'
```

We can retrieve them in the [KuzzleRequest](/core/2/framework/classes/kuzzle-request) object passed to the `handler`:

```js
import assert from 'assert';

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        assert(request.input.args._id === 'JkkZN62jLSA');
        assert(request.input.args.name === 'aschen');
        assert(request.input.args.age === '27');
        assert(request.input.body.city === 'Antalya');
        // equivalent to
        assert(request.getId() === 'JkkZN62jLSA');
        assert(request.getString('name') === 'aschen');
        assert(request.getInteger('age') === '27');
        assert(request.getBodyString('city') === 'Antalya');
      },
      http: [
        { verb: 'POST', path: 'greeting/hello/:name' }
      ]
    }
  }
});
```

::: info
See the [KuzzleRequest Payload](/core/2/api/payloads/request) page for more information about using the API with HTTP.
::: 

### Other protocols

Other protocols directly **use JSON payloads**.  

These payloads contain all the information directly:

```bash
npx wscat -c ws://localhost:7512 --execute '{
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

We can retrieve them in the [KuzzleRequest](/core/2/framework/classes/kuzzle-request) object passed to the `handler`:

```js
import assert from 'assert';

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        assert(request.input.args._id === 'JkkZN62jLSA');
        assert(request.input.args.name === 'aschen');
        assert(request.input.args.age === '27');
        assert(request.input.body.city === 'Antalya');
        // equivalent to
        assert(request.getId() === 'JkkZN62jLSA');
        assert(request.getString('name') === 'aschen');
        assert(request.getInteger('age') === '27');
        assert(request.getBodyString('city') === 'Antalya');
      },
    }
  }
});
```

::: info
See the [KuzzleRequest Payload](/core/2/api/payloads/request) page for more information about using the API with other protocols.
::: 


## KuzzleRequest Context

Information about **the client that executes an API action** are available in the [KuzzleRequest.context](/core/2/framework/classes/request-context) property.

The available properties are as follows:
 - [connection](/core/2/framework/classes/request-context/properties#connection): information about the connection
 - [user](/core/2/framework/classes/request-context/properties#user): information about the user executing the request
 - (optional) [token](/core/2/framework/classes/request-context/properties#token): information about the authentication token

Example:
```js
import assert from 'assert';

app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        assert(request.context.connection.protocol === 'http');
        // Unauthenticated users are anonymous 
        // and the anonymous user ID is "-1"
        assert(request.context.user._id === '-1');
        // equivalent to
        assert(request.getKuid() === '-1');
      },
    }
  }
});
```

::: info
More informations about the [RequestContext](/core/2/framework/classes/request-context/properties) class properties.
:::

## Response format

<!-- Duplicated from /core/2/guides/main-concepts/api -->

Kuzzle Response are **standardized**. This format is shared by all API actions, including custom controller actions.

A [ResponsePayload](/core/2/api/payloads/response) is a **JSON object** with the following format:

| Property     | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `action`     | API action                                                                          |
| `collection` | Collection name, or `null` if no collection was involved                                       |
| `controller` | API controller                                                                             |
| `error`      | [KuzzleError](/core/2/api/errors/types) object, or `null` if there was no error                |
| `index`      | Index name, or `null` if no index was involved                                                 |
| `requestId`  | KuzzleRequest unique identifier                                                                           |
| `result`     | Action result, or `null` if an error occured                                                         |
| `status`     | Response status, using [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) |
| `volatile`   | Arbitrary data repeated from the initial request                                                    |
The `result` property will contain the return of the action `handler` function.


For example, when calling this controller action:
```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        return `Hello, ${request.getString('name')}`;
      }
    }
  }
});
```

The following response will be sent:

```bash
npx wscat -c ws://localhost:7512 --execute '{
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

For this it is possible to use the method [KuzzleRequest.setResult](/core/2/framework/classes/kuzzle-request/set-result) with the `raw` option set to true. This option prevents Kuzzle from standardizing an action's output:

**Example:** _Return a CSV file_

```js
app.controller.register('files', {
  actions: {
    csv: {
      handler: async request => {
        const csv = 'name,age\naschen,27\ncaner,28\n';

        request.setResult(null, {
          raw: true,
          headers: {
            'Content-Length': csv.length.toString(),
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="export.csv"'
          }
        });

        return csv;
      }
    }
  }
});
```

The response will only contain the CSV document:

```bash
curl localhost:7512/_/files/csv

name,age
aschen,27
caner,28
```

You can also change the HTTP status code with the `status` option.

**Example:** _Redirect requests to another website_

```js
app.controller.register('redirect', {
  actions: {
    proxy: {
      handler: async request => {
        request.setResult(null, {
          raw: true,
          // HTTP status code for redirection
          status: 302,
          headers: {
            'Location': 'http://kuzzle.io'
          }
        });
        
        return null;
      }
    }
  }
});
```

## Use a custom Controller Action

As we have seen, controller actions can be executed via different protocols.

We will explore the various possibilities available to execute API actions.

```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        return `Hello, ${request.getString('name')}`;
      }
    }
  }
});
```

### HTTP

Our action can be executed through the HTTP protocol by using an HTTP client (cURL, HTTPie, Postman, ...):

```bash
curl http://localhost:7512/_/greeting/say-hello?name=Yagmur
```

::: info
Default generated routes use the `GET` verb.  
It is therefore possible to open them directly in a browser: [http://localhost:7512/_/greeting/say-hello?name=Yagmur](http://localhost:7512/_/greeting/say-hello?name=Yagmur)
:::

### WebSocket

To execute our action through the WebSocket protocol, we will be using [wscat](https://www.npmjs.com/package/wscat):

```bash
npx wscat -c ws://localhost:7512 --execute '{
  "controller": "greeting",
  "action": "sayHello",
  "name": "Yagmur"
}'
```

### Kourou

From a terminal, [Kourou](https://github.com/kuzzleio/kourou), the Kuzzle CLI, can be used to execute an action:

```bash
kourou greeting:sayHello --arg name=Yagmur
```

It is possible to pass multiple arguments by repeating the `--arg <arg>=<value>` flag or specify a body with the `--body '{}'` flag.  

::: info
More info about [Kourou](https://github.com/kuzzleio/kourou).
:::

### SDK

From one of our [SDKs](/sdk), it is possible to use the `query` method which takes a [KuzzleRequest Payload](/core/2/guides/main-concepts/api#others-protocol) as a parameter.

:::: tabs
::: tab Javascript

Using the Javascript SDK [Kuzzle.query](/sdk/js/7/core-classes/kuzzle/query) method:

```js
const response = await kuzzle.query({
  controller: 'greeting',
  action: 'sayHello',
  name: 'Yagmur'
});
```

:::
::: tab Dart

Using the [Dart SDK](/sdk/dart/2/) Kuzzle.query method:

```dart
final response = await kuzzle.query({
  'controller': 'greeting',
  'action': 'sayHello',
  'name': 'Yagmur'
});
```

:::

::: tab Kotlin

Using the JVM SDK [Kuzzle.query](/sdk/jvm/1/core-classes/kuzzle/query) method:

```kotlin
ConcurrentHashMap<String, Object> query = new ConcurrentHashMap<>();
query.put("controller", "greeting");
query.put("action", "sayHello");
query.put("name", "Yagmur");

Response res = kuzzle.query(query).get();
```

:::

::: tab Csharp

Using the Csharp SDK [Kuzzle.query](/sdk/csharp/2/core-classes/kuzzle/query-async/) method:

```csharp
JObject request = JObject.Parse(@"{
  controller: 'greeting',
  action: 'sayHello',
  name: 'Yagmur'
}");

Response response = await kuzzle.QueryAsync(request);
```
:::


::::


## Allow access to a custom Controller Action

In the rights management system, **[roles](/core/2/guides/main-concepts/permissions#roles) are managing access to API actions**.  

They operate on a whitelist principle by **listing the controllers and actions they give access to**.

So, to allow access to the `greeting:sayHello` action, the following role can be written:

```bash
kourou security:createRole '{
  controllers: {
    greeting: {
      actions: {
        sayHello: true
      }
    }
  }
}' --id steward
```

It is also possible to use a wildcard (`*`) to give access to all of a controller's actions:

```bash
kourou security:createRole '{
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
More info about [Permissions](/core/2/guides/main-concepts/permissions)
:::
