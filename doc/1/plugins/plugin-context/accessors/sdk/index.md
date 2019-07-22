---
code: true
type: page
title: sdk
---

# sdk

<SinceBadge version="1.6.0" />

Accessor to the embedded SDK.

The embedded SDK is a custom version of our [Javascript SDK](/sdk/js/6) that uses a custom protocol plugged directly into Kuzzle core.

All the documented controllers can be used, except the `realtime` one.
Also, the low-level [query](/sdk/js/6/core-classes/kuzzle/query/) method is available for use.

::: info
The embedded SDK methods do not trigger [API events](/core/1/plugins/guides/events/api-events) or [request:on* events](/core/1/plugins/guides/events/request-on-authorized).
:::

### Request context

By default, when using the embedded SDK, requests made to Kuzzle API don't have the same context as the original request received by the plugin.

Typically, the `request.context.user` property is not set and thus [Kuzzle metadata](/core/1/guides/essentials/document-metadata/) will not be set when creating or updating documents.

It is possible to use the same user context as the original request with the embedded SDK, for this purpose it is necessary to use the [as()](/core/1/plugins/plugin-context/accessors/sdk/#as) impersonation method.

When the complete original context is needed to execute your request, plugin developers can use the [accessors.execute](/core/1/plugins/plugin-context/accessors/execute) method.

---

## controllers

The following controllers are available in the embedded SDK:

- [auth](/sdk/js/6/controllers/auth)
- [bulk](/sdk/js/6/controllers/bulk)
- [collection](/sdk/js/6/controllers/collection)
- [document](/sdk/js/6/controllers/document)
- [index](/sdk/js/6/controllers/index)
- [memoryStorage (ms)](/sdk/js/6/ms)
- [security](/core/1/api/controllers/security)
- [server](/sdk/js/6/controllers/server)

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

---

## query

<SinceBadge version="1.6.0" />

Accessor to the [query method](/sdk/js/6/core-classes/kuzzle/query/).
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
| `user`    | <pre>User</pre> | Valid User object |

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
