---
code: false
type: page
title: Understand Application Development
description: Discover the framework capabilities
order: 600
---

# Understand Application Development

Kuzzle is **fully extensible** like any framework. This extensibility is available through the development of an application.

Several classes and methods are available to developers so that they can develop their new business functionalities.

## The Backend class

The [Backend](/core/2/some-link) class is the entrypoint of any Kuzzle application.  

First we need to instantiate it with our application name:

```js
import { Backend } from 'kuzzle'

const app = new Backend('playground')
```

An application has two states, `instantiated` and `started`. The classes and methods that can be used depend on the state the application is in. 

::: info
Calling the [Backend.start](/core/2/some-link) method will start your application and change it's state to `started`.
:::

There are two categories of functionalities:
 - `registration`: available **before** starting the application
 - `interaction`: available **after** starting the application

## Register new features

When theg application is in the instanciated state, it exposes methods to **register new features** in Kuzzle core, like:
 - `controllers`: extend the API
 - `pipes`: modify API behavior
 - `hooks`: execute asynchronous processing
 - `plugins`: add whole set of features

**Example:** Registering a new Controller with [Backend.controller.register](/core/2/some-link) method
```js
// before application startup
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

Once the features have been registered, it is possible to start our Kuzzle application with the [Backend.start](/core/2/some-link) method.

::: warning
Once the application has been started with the [Backend.start](/core/2/some-link) method, **it is no longer possible to register new features**.
:::

We will see in detail how to add controllers and pipes in the next chapters of this Getting Started.

## Interact with the application

Once the application is started, it provides methods to interact with your Kuzzle application.

In particular, they make it possible to:
 - use the [Embedded SDK](/core/2/some-link) to use the API
 - trigger events
 - log messages
 - and more..!

**Example:** Use the Embedded SDK to create an index after startup with the [index.create](/sdk/js/7/controllers/index/create) method
```js
app.start()
  .then(async () => {
    // interact with Kuzzle API to creates a new index if it does not exists
    if (! await app.sdk.index.exists('nyc-open-data')) {
      await app.sdk.index.create('nyc-open-data')
    }
  })
  .catch(console.error)
```

::: warning
These methods interact directly with Kuzzle API and internal modules and are therefore not available until the application has been started with the [Backend.start](/core/2/some-link) method.
:::

### Embedded SDK

In order to use the API actions, Kuzzle exposes the [Embedded SDK](/core/2/some-link) through the [Backend](/core/2/some-link) class.  

You can acces it through the [Backend.sdk](/core/2/some-link) property.  

::: info
The Embedded SDK is a modified version of the [Javascript SDK](/sdk/js/7) which is directly connected to the API and does not go through the network.  
:::

You can access the following controllers from the API:
- [auth](/sdk/js/7/controllers/auth)
- [bulk](/sdk/js/7/controllers/bulk)
- [collection](/sdk/js/7/controllers/collection)
- [document](/sdk/js/7/controllers/document)
- [index](/sdk/js/7/controllers/index)
- [memoryStorage (ms)](/sdk/js/7/controllers/ms)
- [security](/sdk/js/7/controllers/security)
- [server](/sdk/js/7/controllers/server)
- [realtime](/sdk/js/7/controllers/realtime)

::: info 
The low level [query](/sdk/js/7/core-classes/kuzzle/query) method can also be used to send custom requests to Kuzzle API.  
:::

**Example:** Create a new document by using the [document.create](/sdk/js/7/controllers/document/create) method
```js
// after application startup

// creates a document
await app.sdk.document.create('nyc-open-data', 'yellow-taxi', {
  name: 'Aschen',
  age: 27
})

// execute a custom controller action
await app.sdk.query({
  controller: 'greeting',
  action: 'name',
  name: 'Aschen'
})
```

## Complete example

```js
import { Backend } from 'kuzzle'

// instantiate an application
const app = new Backend('playground')

// now we can register features

// register a new controller
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})

// start the application
app.start()
  .then(async () => {
    // now we can interact with Kuzzle API

    // interact with Kuzzle API to creates a new index if it does not exists
    if (! await app.sdk.index.exists('nyc-open-data')) {
      await app.sdk.index.create('nyc-open-data')
    }
  })
  .catch(console.error)
```