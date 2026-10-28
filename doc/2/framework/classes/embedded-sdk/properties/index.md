---
code: false
type: page
title: Properties | Framework | Core

description: EmbeddedSDK class properties
---

# EmbeddedSDK

The `EmbeddedSDK` is a modified version of the Javascript SDK.

It inherits from the [Kuzzle](/sdk/js/7/core-classes/kuzzle) class of the Javascript SDK.

It is **directly connected to the Kuzzle API** and requests **do not go through the network**.

It is accessible within an application through the [Backend.sdk](/core/2/framework/classes/backend/properties#sdk) property.

Plugins access it through the [PluginContextAccessors.sdk](/core/2/framework/classes/plugin-context-accessors/properties#sdk) property, and controllers through the [Controller.sdk](/core/2/framework/abstract-classes/controller/properties#sdk) property.

See also the [EmbeddedSDK](/core/2/guides/develop-on-kuzzle/embedded-sdk) guide.

::: info
`app.sdk` is already a connected client: you do not need to instantiate one to call the API from an application.

<DeprecatedBadge version="2.57.0" />

The `kuzzle` package still re-exports the `Kuzzle`, `WebSocket`, `Http` and `KuzzleAbstractProtocol` classes of the Javascript SDK, but this is deprecated. To connect to a Kuzzle server as a client, import them from the [kuzzle-sdk](https://www.npmjs.com/package/kuzzle-sdk) package instead.
:::

## Differences with the Javascript SDK

- The following `auth` controller actions cannot be called, because the embedded SDK is not authenticated: `checkRights`, `createApiKey`, `createMyCredentials`, `credentialsExist`, `deleteApiKey`, `getCurrentUser`, `getMyCredentials`, `getMyRights`, `getStrategies`, `logout`, `refreshToken`, `searchApiKeys`, `updateMyCredentials`, `updateSelf` and `validateMyCredentials`. They throw an `api.process.forbidden_embedded_sdk_action` error. Use [user impersonation](/core/2/framework/classes/embedded-sdk/as) or the `security` controller instead.
- `auth:login` is deprecated: use [user impersonation](/core/2/framework/classes/embedded-sdk/as) instead.
- `realtime.subscribe` accepts an additional `propagate` option. If `true`, the notification callback is executed on every node of the cluster. The default is `false`: the callback is only executed on the node where the subscription was made.

## Properties

See the [Kuzzle](/sdk/js/7/core-classes/kuzzle/properties) class of the Javascript SDK.
