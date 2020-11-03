---
code: false
type: page
title: Core Modules
description: tbd
order: 200
---

# Core Modules

Kuzzle offers a set of classes and methods through the [Backend](/core/2/some-link) class.

Some of these features are only available during the `setup` phase of the application while others are only available during the `runtime` phase.

::: info
The `runtime` phase starts after calling the [Backend.start](/core/2/some-link) method.
:::

Those features are exposed through the properties of the [Backend](/core/2/some-link) class:
 - [sdk](/core/2/guides/develop-on-kuzzle/1-core-modules#embedded-sdk): modified version of the [Javascript SDK](/sdk/js/7) to execute API actions
 - [storage](/core/2/guides/develop-on-kuzzle/1-core-modules#storage-client): use Node.js Elasticsearch client to send direct requests to Elasticsearch
 - [log](/core/2/guides/develop-on-kuzzle/1-core-modules#internal-logger): internal logger
 - [trigger](/core/2/guides/develop-on-kuzzle/1-core-modules#trigger-events): trigger internal or custom events
 - [kerror](/core/2/guides/develop-on-kuzzle/1-core-modules#error-manager): error manager
 - [config](/core/2/guides/develop-on-kuzzle/1-core-modules#configuration): access and modify configuration

## Embedded SDK

::: warning
The Embedded SDK is available only in the `runtime` phase, after application startup.
::: 

<!-- Duplicate /core/2/guides/getting-started/6-write-application -->

In order to use the API actions, Kuzzle exposes the [Embedded SDK](/core/2/some-link).  

The Embedded SDK is a modified version of the [Javascript SDK](/sdk/js/7) which is directly connected to the API and **does not send requests through the network**.  

You can access it through the [Backend.sdk](/core/2/some-link) property. 

### Controllers

The following controllers are available in the embedded SDK:

- [auth](/sdk/js/7/controllers/auth)
- [bulk](/sdk/js/7/controllers/bulk)
- [collection](/sdk/js/7/controllers/collection)
- [document](/sdk/js/7/controllers/document)
- [index](/sdk/js/7/controllers/index)
- [memoryStorage (ms)](/sdk/js/7/controllers/ms)
- [security](/sdk/js/7/controllers/security)
- [server](/sdk/js/7/controllers/server)
- [realtime](/sdk/js/7/controllers/realtime)

::: warning
The behavior of the [realtime:subscribe](/sdk/js/7/controllers/realtime) method is slightly different when it's used with the Embedded SDK.  
Learn more about [Backend Realtime Subscriptions](/core/2/guides/develop-on-kuzzle/1-core-module#backend-realtime-subscriptions)
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

### Query method

<!-- Duplicate /core/2/guides/getting-started/6-write-application -->

The low level [query](/sdk/js/7/core-classes/kuzzle/query) method can also be used to send custom requests to the Kuzzle API.  

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

### User impersonation

By default, when using the embedded SDK, requests made to Kuzzle API don't have the same context as the original request received by the plugin.

Typically, the `request.context.user` property is not set and thus [Kuzzle metadata](/core/2/some-link) will not be set when creating or updating documents.

It is possible to use the same user context as the original request with the Embedded SDK, for this purpose it is necessary to use the [EmbeddedSDK.as](/core/2/some-link) method.

**Example:** _Creating a document as the original API user to preserv Kuzzle metadata_
```js
app.controller.register('drivers', {
  actions: {
    create: {
      handler: async request => {
        const originalUser = request.context.user

        return app.sdk.as(originalUser).document.create(
          'nyc-open-data',
          'yellow-taxi',
          { name: 'Aschen' })
       }
    }
  }
})
```

::: warning
User permissions are not applied even when the [EmbeddedSDK.as](/core/2/some-link) method is used.
:::

### Backend Realtime Subscriptions

Realtime subscriptions should be made using the [realtime controller](/sdk/js/7/controllers/realtime) just after the application startup.

::: warning
You should avoid making subscriptions at runtime because that can lead to unwanted behavior, since the subscriptions won't be replicated on other cluster nodes.
:::

The `propagate` option defines if, for that subscription, notifications should be propagated to (and processed by) all cluster nodes, or if only the node having received the triggering event should handle it.

#### propagate: false (default)

With `propagate: false`, the callback function is executed only on the node on which a notification is generated (only one execution).

::: info 
This behavior is suitable for most usage like sending emails, write in the database, call an external API, etc.
:::

**Example:**

```js
app.start()
  .then(async () => {
    // The default value for the "propagate" option is "false"
    await app.sdk.realtime.subscribe(
      'nyc-open-data',
      'yellow-taxi',
      {},
      notification => {
        // This callback will be executed only on the node generating a notification
      })
  })
```

#### propagate: true

With `propagate: true`, notifications are propagated to all nodes of a cluster, executing all callback functions.

::: info 
This behavior is suitable for synchronizing RAM cache amongst cluster nodes for example.
:::


**Example:**

```js
app.start()
  .then(async () => {

    await app.sdk.realtime.subscribe(
      'nyc-open-data',
      'yellow-taxi',
      {},
      notification => {
        // This callback will be executed on each nodes
      },
      { propagate: true })
  })
```

## Storage Client

Kuzzle uses and exposes [Elasticsearch Javascript SDK](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html). 

It is possible to interact directly with Elasticsearch through clients exposed in the [Backend.storage](/core/2/some-link) property.

This property offers the possibility to instantiate a new client or to use a pre-instantiated client. In both cases, the clients are configured to use the same Elasticsearch cluster as Kuzzle.

::: info
It is possible to overload the configuration used by default by instantiating a new Ealsticsearch client with the constructor [Backend.storage.Client](/core/2/some-link).
:::


**Example:** _Send a request directly to Elasticsearch_

```js
// Elasticsearch request to create a document
const esRequest =  {
  body: {
    name: 'Aschen',
    age: 27
  },
  index: '%nyc-open-data.yellow-taxi',
  op_type: 'create'
}

// Use directly an Elasticsearch client instance
await app.storage.client.index(esRequest)

// Instantiate and use a new client
const esClient = new app.storage.Client()
await esClient.index(esRequest)
```

::: warning
Kuzzle use an [internal naming system](/core/2/guides/main-concepts/2-data-storage#some-anchor) to map Elasticsearch index names with Kuzzle indexes and collections names.
:::

## Internal Logger

::: warning
The Internal Logger is available only in the `runtime` phase, after application startup.
::: 

Kuzzle exposes an internal logger with 5 priority levels:
 - debug (not printed by default)
 - verbose (not printed by default)
 - info
 - warn
 - error

Messages will be logged using the [util.inspect](https://nodejs.org/api/util.html#util_util_inspect_object_options) method from Node.js.

By default the log level is set to `info`. You can change this [configuration](/core/2/guides/advanced/8-configuration) under the `plugins.kuzzle-plugin-logger.services.stdout.level` configuration key.

**Example:** _Set the log level to verbose and log verbose messages_

```js
import { Backend } from 'kuzzle';

const app = new Backend('black-mesa');

// Set log level to verbose
app.config.set(
  'plugins.kuzzle-plugin-logger.services.stdout.level', 
  'verbose')

app.start()
  .then(() => {
    app.log.debug('debug')
    app.log.verbose('verbose')
    app.log.info('info')
    app.log.warn('warn')
  })
```

::: info
More info about [Internal Logger](/core/2/guides/advanced/10-internal-logger) configuration and usage.
:::

## Trigger Events

::: warning
You can only trigger custom events in the `runtime` phase, after application startup.
::: 

Internal or custom events can be triggered with the [Backend.trigger](/core/2/some-link) method.

Pipes and hooks can be plugged on custom events as well as on internal events.

::: info
It's considered as a good practice to prefix your event name with your application name.
:::

**Example:** _Trigger a custom event_

```js
await app.trigger('app-name/file-available', fileUrl);
```

::: warning
If an internal event is triggered, the payload must be the same as the original event.
:::

## Error Manager

Kuzzle exposes it's standard errors through an Error Manager class available under the [Backend.kerror](/core/2/some-link) property.

The following constructors are available directly in the [Backend.kerror](/core/2/some-link) property:
  - [Backend.kerror.KuzzleError](/core/2/some-link#some-anchor)
  - [Backend.kerror.UnauthorizedError](/core/2/some-link#some-anchor)
  - [Backend.kerror.TooManyRequestsError](/core/2/some-link#some-anchor)
  - [Backend.kerror.SizeLimitError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ServiceUnavailableError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PreconditionError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PluginImplementationError](/core/2/some-link#some-anchor)
  - [Backend.kerror.PartialError](/core/2/some-link#some-anchor)
  - [Backend.kerror.NotFoundError](/core/2/some-link#some-anchor)
  - [Backend.kerror.InternalError](/core/2/some-link#some-anchor)
  - [Backend.kerror.GatewayTimeoutError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ForbiddenError](/core/2/some-link#some-anchor)
  - [Backend.kerror.ExternalServiceError](/core/2/some-link#some-anchor)
  - [Backend.kerror.BadRequestError](/core/2/some-link#some-anchor)

::: info
If a non-standard error is thrown then Kuzzle will include it in a `PluginImplementationError`.
:::

**Example:** _Throw a PreconditionError when an action parameter is missing_
```js
app.controller.register('greeting', {
  actions: {
    sayHello: {
      handler: async request => {
        if (request.input.args.name === undefined) {
          throw new app.kerror.PreconditionError('Missing "name" argument.')
        }

        return `Hello, ${request.input.args.name}`
       }
    }
  }
})
```

TODO: add ImplementationError

## Configuration

The configuration of Kuzzle is also accessible through the [Backend.config](/core/2/some-link) property.

It is possible to consult or modify values of the configuration. 

The set of keys that can be configured is available in the file [.kuzzlerc.sample](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample)

::: info
See the [Configuration](/core/2/guides/advanced/8-configuration) guide for more informations on how to configure Kuzzle.
:::

**Example:** _Change configuration values_
```js
// Read a configuration value
console.log(`Kuzzle will listen on port ${app.config.content.server.port}`)

// Set log level to verbose
app.config.set(
  'plugins.kuzzle-plugin-logger.services.stdout.level', 
  'verbose')
```

::: warning
It's not possible to change the configuration after the application as started
:::