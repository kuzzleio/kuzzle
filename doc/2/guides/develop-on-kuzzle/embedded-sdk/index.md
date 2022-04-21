---
code: false
type: page
title: Embedded SDK
description: Execute API action from backend code
order: 200
---

# Embedded SDK

::: info
The Embedded SDK is available only during the `runtime` phase, after the application has started.
:::

<!-- Duplicate /core/2/guides/getting-started/write-application -->

In order to use the API actions, Kuzzle exposes the **Embedded SDK**.

The Embedded SDK is a **modified version of the [Javascript SDK](/sdk/js/7)** which is directly connected to the API and **does not send requests through the network**.

You can access it through the [Backend.sdk](/core/2/framework/classes/embedded-sdk) property.

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
Learn more about [Backend Realtime Subscriptions](/core/2/guides/develop-on-kuzzle/embedded-sdk#backend-realtime-subscriptions)
:::

::: warning
The [auth controller](/sdk/js/7/controllers/auth/) is deprecated in the embedded sdk. [User impersonation](/core/2/guides/develop-on-kuzzle/embedded-sdk#user-impersonation) or usage of the [security controller](/sdk/js/7/controllers/security/) is preferred.
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

## Query method

<!-- Duplicate /core/2/guides/getting-started/write-application -->

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
});
```

## User impersonation

By default, when using the Embedded SDK, requests **don't have the same context as the original request** received by Kuzzle.

Typically, the `request.context.user` property is not set and thus **[Kuzzle metadata](/core/2/guides/main-concepts/data-storage#kuzzle-metadata) will not be set when creating or updating documents**.

It is possible to use the same user context as the original request with the EmbeddedSDK, for this purpose it is necessary to use the [EmbeddedSDK.as](/core/2/framework/classes/embedded-sdk/as) method.

**Example:** _Creating a document as the original API user to preserve Kuzzle metadata_
```js
app.controller.register('drivers', {
  actions: {
    create: {
      handler: async request => {
        const originalUser = request.getUser();

        return app.sdk.as(originalUser).document.create(
          'nyc-open-data',
          'yellow-taxi',
          { name: 'Aschen' });
       }
    }
  }
});
```

::: info
<SinceBadge version="2.10.0" />
If you need to verify if a User is authorized to execute any given API actions, you can do so by using the [EmbeddedSDK.as](/core/2/framework/classes/embedded-sdk/as) `checkRights` option.
:::

**Example:** _Execute an impersonated action only if the required User is allowed to do so_
```js
app.controller.register('drivers', {
  actions: {
    create: {
      handler: async request => {
        const originalUser = request.getUser();
        const impersonatedSdk = app.sdk.as(originalUser, { checkRights: true });

        // Will fail if "originalUser" is not allowed to create documents
        return impersonatedSdk.document.create(
          'nyc-open-data',
          'yellow-taxi',
          { name: 'Aschen' });
       }
    }
  }
});
```

## Backend Realtime Subscriptions

Realtime subscriptions should be made using the [Realtime Controller](/sdk/js/7/controllers/realtime) **just after the application has started**.

Realtime subscriptions performed by an application are used so that an application gets notified about changes, and can act upon them. The behavior is the same as when a client subscribes, but since the entity performing the subscription is different (client vs. application), the feature accessible by an application has some new options to fine tune how notifications are propagated across a Kuzzle cluster.

::: warning
You should **avoid making dynamic subscriptions at runtime**, because that can lead to unwanted behavior, since those subscriptions won't be replicated to other cluster nodes.
:::

The `propagate` option defines if, for that subscription, the callback execution should be propagated to all cluster nodes, or if only the node generating the notification should execute its callback.

### propagate: false (default)

With `propagate: false` only the node who generates the notification will execute the callback function

::: info
This behavior is suitable for most usages like sending emails, write to the database, call an external API, etc.
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
      });
  });
```

### propagate: true

With `propagate: true`, the callback function will be **executed on all nodes of the cluster**.

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
      { propagate: true });
  });
```
