---
code: true
type: page
title: sdk
---

# sdk

<SinceBadge version="1.6.0" />

Accessor to the embedded SDK.

The embedded SDK is a custom version of our [Javascript SDK](/sdk/js/7) that uses a custom protocol plugged directly into Kuzzle core.

All the documented controllers can be used.
Also, the low-level [query](/sdk/js/7/core-classes/kuzzle/query) method is available for use.

::: info
The embedded SDK methods do not trigger [API events](/core/2/plugins/guides/events/api-events) or [request:on* events](/core/2/plugins/guides/events/request-on-authorized).
:::

### Request context

By default, when using the embedded SDK, requests made to Kuzzle API don't have the same context as the original request received by the plugin.

Typically, the `request.context.user` property is not set and thus [Kuzzle metadata](/core/2/guides/essentials/document-metadata) will not be set when creating or updating documents.

It is possible to use the same user context as the original request with the embedded SDK, for this purpose it is necessary to use the [as()](/core/2/plugins/plugin-context/accessors/sdk#as) impersonation method.

When the complete original context is needed to execute your request, plugin developers can use the [accessors.execute](/core/2/plugins/plugin-context/accessors/execute) method.

---

## Controllers

The following controllers are available in the embedded SDK:

- [auth](/sdk/js/7/controllers/auth)
- [bulk](/sdk/js/7/controllers/bulk)
- [collection](/sdk/js/7/controllers/collection)
- [document](/sdk/js/7/controllers/document)
- [index](/sdk/js/7/controllers/index)
- [memoryStorage (ms)](/sdk/js/7/controllers/ms)
- [security](/sdk/js/7/controllers/security)
- [server](/sdk/js/7/controllers/server)

<SinceBadge version="1.9.1" />

The following controllers and methods are partially available in the embedded SDK:
  - [realtime](/sdk/js/7/controllers/realtime)
    - [count](/sdk/js/7/controllers/realtime/count)
    - [publish](/sdk/js/7/controllers/realtime/count)

### Example

```js
async myAwesomePipe (request) {
  await this.context.accessors.sdk.document.create(
    'nyc-open-data',
    'yellow-taxi',
    { licence: 'B' }
  );

  return request;
}
```

**Notes:**

- The created document will have the `author` metadata property set to `null`.

## Realtime notifications

<SinceBadge version="change-me" />

The [realtime](/sdk/js/7/controllers/realtime) is entirely available with the [subscribe](/sdk/js/7/controllers/realtime/subscribe) and [unsubscribe](/sdk/js/7/controllers/realtime/unsubscribe) methods.  

Realtime subscriptions should be made in the plugin [init](core/2/plugins/guides/manual-setup/init-function) method or in a hook on the [kuzzle:start:before](/core/2/plugins/guides/events/kuzzle-start) event.

::: warning
You should avoid making subscriptions at runtime because that can lead to unwanted behavior, since the subscriptions won't be replicated on other cluster nodes.
:::

The `propagate` option defines if, for that subscription, notifications should be propagated to (and processed by) all cluster nodes, or if only the node having received the triggering event should handle it.

By default When you receive a notification, only one node will execute the associated callback.  

#### propagate: false (default)

With `propagate: false`, the callback function is executed only on the node on which a notification is generated (only one execution).

::: info 
This behavior is suitable for most usage like sending emails, write in the database, call an external API, etc.
:::

#### propagate: true

With `propagate: true`, notifications are propagated to all nodes of a cluster, executing all callback functions.

::: info 
This behavior is suitable for synchronizing RAM cache amongst cluster nodes for example.
:::

#### Example

```js
async init (config, context) {
  context.accessors.sdk.realtime.subscribe(
    'nyc-open-data',
    'yellow-taxi',
    {},
    notification => {
      // this callback will be executed only on one node
    });


  // the default value for the "propagate" option is "true"
  context.accessors.sdk.realtime.subscribe(
    'nyc-open-data',
    'green-taxi',
    {},
    notification => {
      // this callback will be executed on each nodes
    },
    { propagate: true });
}
```

---

## query

<SinceBadge version="1.6.0" />

Accessor to the [query method](/sdk/js/7/core-classes/kuzzle/query).
This can be useful to call plugins custom controller action.

### Example

```js
async myAwesomePipe (request) {
  await this.context.accessors.sdk.query({
    controller: 'custom-plugin/derbyController',
    action: 'play',
    body: {
      type: 'roller',
      playerIds: [21, 42, 84]
    }
  });

  return request;
}
```

---

## as

<SinceBadge version="1.7.0" />

Execute the following query as the original request user.

### Arguments

```js
as(user);
```

<br/>

| Arguments | Type            | Description       |
| --------- | --------------- | ----------------- |
| `user`    | <pre>User</pre> | User object containing at least a string `_id` property |

### Example

```js
async myAwesomePipe (request) {
  await this.context.accessors.sdk.as(request.context.user).document.create(
    'nyc-open-data',
    'yellow-taxi',
    { licence: 'B' }
  );

  return request;
}
```

**Notes:**

- The created document will have the `author` metadata property set to the impersonated user ID.

### Return

Returns the embedded SDK contextualized with the provided user.

---
