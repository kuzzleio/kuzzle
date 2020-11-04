---
code: false
type: page
title: Embedded SDK
description: Execute API action from backend code
order: 200
---

# Embedded SDK

::: info
The Embedded SDK is available only in the `runtime` phase, after application startup.
::: 

<!-- Duplicate /core/2/guides/getting-started/6-write-application -->

In order to use the API actions, Kuzzle exposes the [Embedded SDK](/core/2/some-link).  

The Embedded SDK is a **modified version of the [Javascript SDK](/sdk/js/7)** which is directly connected to the API and **does not send requests through the network**.  

You can access it through the [Backend.sdk](/core/2/some-link) property. 

## Controllers

The following controllers are available in the embedded SDK:

- [auth](/sdk/js/7/controllers/auth)
- [bulk](/sdk/js/7/controllers/bulk)
- [collection](/sdk/js/7/controllers/collection)
- [document](/sdk/js/7/controllers/document)
- [index](/sdk/js/7/controllers/index)
- [ms (memoryStorage)](/sdk/js/7/controllers/ms)
- [security](/sdk/js/7/controllers/security)
- [server](/sdk/js/7/controllers/server)
- [realtime](/sdk/js/7/controllers/realtime)

::: warning
The behavior of the [realtime:subscribe](/sdk/js/7/controllers/realtime) method is slightly different when it's used with the Embedded SDK.  
Learn more about [Backend Realtime Subscriptions](/core/2/guides/develop-on-kuzzle/1-embedded-sdk#backend-realtime-subscriptions)
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

## Query method

<!-- Duplicate /core/2/guides/getting-started/6-write-application -->

The low level [query](/sdk/js/7/core-classes/kuzzle/query) method can also be used to **send custom requests to the Kuzzle API**.  

**Example:** _Execute a custom controller action with the [query](/sdk/js/7/core-classes/kuzzle/query) method_
```js
// After application startup

// [...]

// Execute a custom controller action
await app.sdk.query({
  controller: 'greeting',
  action: 'sayHello',
  name: 'Aschen'
})
```

## User impersonation

By default, when using the Embedded SDK, requests **don't have the same context as the original request** received by Kuzzle.

Typically, the `request.context.user` property is not set and thus **[Kuzzle metadata](/core/2/some-link) will not be set when creating or updating documents**.

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

## Backend Realtime Subscriptions

Realtime subscriptions should be made using the [Realtime Controller](/sdk/js/7/controllers/realtime) **just after the application startup**.

::: warning
You should **avoid making dynamic subscriptions at runtime because** that can lead to unwanted behavior, since the subscriptions won't be replicated on other cluster nodes.
:::

The `propagate` option defines if, for that subscription, notifications should be propagated to (and processed by) all cluster nodes, or if only the node having received the triggering event should handle it.

### propagate: false (default)

With `propagate: false`, the callback function is **executed only one node**, the one on which the notification is generated (only one execution).

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

### propagate: true

With `propagate: true`, notifications are propagated to all nodes of a cluster, **executing the callback function on each nodes**.

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
