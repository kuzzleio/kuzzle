---
code: false
type: page
order: 600
title: Write an Application | Kuzzle Getting Started | Guide | Core
meta:
  - name: description
    content: Discover the framework capabilities
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, Write an Application, iot, backend, opensource
---

# Write an Application

Kuzzle is **fully extensible** like any framework. This extensibility is available through the development of an application.

Several classes and methods are available to developers so that they can develop their new business functionalities.

## The Backend class

The [Backend](/core/2/framework/classes/backend) class is the entrypoint of any Kuzzle application.  

First we need to instantiate it with an application name:

```js
import { Backend } from 'kuzzle';

const app = new Backend('playground');
```

An application has two phases: `setup` and `runtime`. The classes and methods that can be used **depend on the phase the application is in**. 

::: info
Calling the [Backend.start](/core/2/framework/classes/backend/start) method will start your application and change it's phase to `runtime`.
:::

## Register new features

When the application is in the `setup` phase, it exposes methods allowing to **register new features** to Kuzzle, such as:
 - `controllers`: extend the API
 - `pipes`: modify the API behavior
 - `hooks`: execute asynchronous processing
 - `plugins`: add whole set of features

**Example:** _Registering a new Controller with the [Backend.controller.register](/core/2/framework/classes/backend-controller/register) method_
```js
// Before application startup
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        return `Hello, ${request.input.args.name}`;
      }
    }
  }
});
```

Once the features have been registered, it is possible to start our Kuzzle application with the [Backend.start](/core/2/framework/classes/backend/start) method.

::: warning
Once the application has been started with the [Backend.start](/core/2/framework/classes/backend/start) method, **it is no longer possible to register new features**.
:::

We will see in detail how to add controllers and pipes in the next chapters of this guide.

## Interact with the application

Once the application has started, methods to interact with it become available.

In particular, those methods make it possible to:
 - Use the [Embedded SDK](/core/2/guides/develop-on-kuzzle/embedded-sdk) to execute API actions
 - Trigger Events
 - Log Messages
 - And much more!

**Example:** _Use the Embedded SDK to count documents after startup with the [document.count](/sdk/js/7/controllers/document/count) method_
```js
app.start()
  .then(async () => {
    const count = await app.sdk.document.count('nyc-open-data', 'yellow-taxi');
    app.log.info(`${count} taxis in the database`);
  })
  .catch(console.error);
```

::: warning
Some methods interact directly with the Kuzzle API and with internal modules. Therefore they aren't available until the application has been started with the [Backend.start](/core/2/framework/classes/backend/start) method.
:::

### Embedded SDK

In order to use the API actions, Kuzzle exposes an [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) instance through the [Backend](/core/2/framework/classes/backend) class.  

You can access it through the [Backend.sdk](/core/2/framework/classes/backend/properties#sdk) property.  

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
});
```

The low level [query](/sdk/js/7/core-classes/kuzzle/query) method can also be used to send custom requests to the Kuzzle API.  

**Example:** _Execute a custom controller action with the [query](/sdk/js/7/core-classes/kuzzle/query) method_
```js
// After application startup

// [...]

// Execute a custom controller action
await app.sdk.query({
  controller: 'greeting',
  action: 'sayHello',
  name: 'Aschen'
});
```

## Initialize data at startup

Several nodes of a [cluster](/core/2/guides/advanced/cluster-scalability) can start at the same time, so startup code must not assume it runs alone. For instance, checking that an index does not exist and then creating it fails when two nodes do it at once: both see no index, and the second creation fails with `index_already_exists`.

Kuzzle offers cluster-safe ways to initialize data:

- **Declare your indexes, collections and mappings** with [app.import.mappings](/core/2/framework/classes/backend-import/mappings) before starting the application. They are created at startup by one node, while the other nodes wait for it. Permissions can be declared the same way with [app.import.roles](/core/2/framework/classes/backend-import/roles), [profiles](/core/2/framework/classes/backend-import/profiles) and [users](/core/2/framework/classes/backend-import/users).
- **Run code only once per environment** with [app.install](/core/2/framework/classes/backend/install): the handler runs on the first start only, by a single node, and is recorded so that it never runs again on this environment (e.g. to load initial documents, or to migrate data when releasing a new version). If the handler throws, the application does not start.
- **Run code on one node at a time** with [withLock](/core/2/framework/functions/with-lock), once the application has started.

**Example:** _Declare an index and its collection, and migrate existing documents once_
```js
app.import.mappings({
  'nyc-open-data': {
    'yellow-taxi': {
      mappings: {
        properties: {
          name: { type: 'keyword' },
          age: { type: 'integer' }
        }
      }
    }
  }
});

// The id identifies this installation: use a new id to run new code
app.install('taxis-default-age', async () => {
  // Elasticsearch 7 client request; "&nyc-open-data.yellow-taxi" is the
  // Elasticsearch name of the "yellow-taxi" collection
  await app.storage.storageClient.updateByQuery({
    index: '&nyc-open-data.yellow-taxi',
    body: {
      query: { bool: { must_not: { exists: { field: 'age' } } } },
      script: { source: 'ctx._source.age = 0' }
    }
  });
}, 'Give an age to the taxis that have none');
```

::: warning
Installation handlers run while the application starts, before [app.sdk](/core/2/framework/classes/backend/properties#sdk) is available: use [app.storage](/core/2/framework/classes/backend-storage) to access the data.
:::

**Example:** _Make sure only one node at a time runs a task_
```js
import { withLock } from 'kuzzle';

app.start()
  .then(async () => {
    await withLock('nyc-open-data:init', async () => {
      if (! await app.sdk.index.exists('nyc-open-data')) {
        await app.sdk.index.create('nyc-open-data');
      }
    });
  })
  .catch(console.error);
```

## Complete example

```js
import { Backend } from 'kuzzle';

// Instantiate an application
const app = new Backend('playground');

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
});

// Declare the indexes and collections to create at startup
app.import.mappings({
  'nyc-open-data': {
    'yellow-taxi': {
      mappings: {
        properties: {
          name: { type: 'keyword' },
          age: { type: 'integer' }
        }
      }
    }
  }
});

// Start the application
app.start()
  .then(async () => {
    // Now we can interact with Kuzzle API
    app.log.info('Application started');
  })
  .catch(console.error);
```

<GuidesLinks
  :prev="{ text: 'Subscribe to Realtime Notifications', url: '/guides/getting-started/subscribe-realtime-notifications/' }" 
  :next="{ text: 'Create new Controllers', url: '/guides/getting-started/create-new-controllers' }" 
/>
