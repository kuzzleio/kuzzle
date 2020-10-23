---
code: false
type: page
title: Write an Application
description: Discover the framework capabilities
order: 600
---

# Write an Application

Kuzzle is **fully extensible** like any framework. This extensibility is available through the development of an application.

Several classes and methods are available to developers so that they can develop their new business functionalities.

## The Backend class

The [Backend](/core/2/some-link) class is the entrypoint of any Kuzzle application.  

First we need to instantiate it with an application name:

```js
import { Backend } from 'kuzzle'

const app = new Backend('playground')
```

An application has two states: `instantiated` and `started`. The classes and methods that can be used depend on the state the application is in. 

::: info
Calling the [Backend.start](/core/2/some-link) method will start your application and change its state to `started`.
:::

There are two categories of functionalities:
 - `registration`: available **before** starting the application
 - `interaction`: available **after** starting the application

## Register new features

When the application is in the `instantiated` state, it exposes methods allowing to **register new features** to Kuzzle, such as:
 - `controllers`: extend the API
 - `pipes`: modify the API behavior
 - `hooks`: execute asynchronous processing
 - `plugins`: add whole set of features

**Example:** _Registering a new Controller with the [Backend.controller.register](/core/2/some-link) method_
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

We will see in detail how to add controllers and pipes in the next chapters of this guide.

## Interact with the application

Once the application has started, methods to interact with your Kuzzle application become available.

In particular, those methods make it possible to:
 - Use the [Embedded SDK](/core/2/some-link) to use the API
 - Trigger Events
 - Log Messages
 - And much more!

**Example:** Use the Embedded SDK to create an index after startup with the [index.create](/sdk/js/7/controllers/index/create) method
```js
app.start()
  .then(async () => {
    // Interact with Kuzzle API to create a new index if it does not already exist
    if (! await app.sdk.index.exists('nyc-open-data')) {
      await app.sdk.index.create('nyc-open-data')
    }
  })
  .catch(console.error)
```

::: warning
These methods interact directly with the Kuzzle API and with internal modules. Therefore they aren't available until the application has been started with the [Backend.start](/core/2/some-link) method.
:::

### Embedded SDK

In order to use the API actions, Kuzzle exposes the [Embedded SDK](/core/2/some-link) through the [Backend](/core/2/some-link) class.  

You can access it through the [Backend.sdk](/core/2/some-link) property.  

::: info
The Embedded SDK is a modified version of the [Javascript SDK](/sdk/js/7) which is directly connected to the API and does not send requests through the network.  
:::

**Example:** _Create a new document by using the [document.create](/sdk/js/7/controllers/document/create) method_
```js
// After application startup

// [...]

// Creates a document
await app.sdk.document.create('nyc-open-data', 'yellow-taxi', {
  name: 'Aschen',
  age: 27
})
```

::: info 
The low level [query](/sdk/js/7/core-classes/kuzzle/query) method can also be used to send custom requests to the Kuzzle API.  
:::

**Example:** _Execute a custom controller action with the [query](/sdk/js/7/core-classes/kuzzle/query) method_
```js
// After application startup

// [...]

// Execute a custom controller action
await app.sdk.query({
  controller: 'greeting',
  action: 'name',
  name: 'Aschen'
})
```

## Complete example

```js
import { Backend } from 'kuzzle'

// Instantiate an application
const app = new Backend('playground')

// Now we can register features

// Register a new controller
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`
      }
    }
  }
})

// Start the application
app.start()
  .then(async () => {
    // Now we can interact with Kuzzle API to create a new index if it does not exists
    if (! await app.sdk.index.exists('nyc-open-data')) {
      await app.sdk.index.create('nyc-open-data')
    }
  })
  .catch(console.error)
```
