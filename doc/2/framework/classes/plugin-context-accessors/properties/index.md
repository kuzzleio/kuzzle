---
code: false
type: page
title: Properties
description: PluginContextAccessors class properties
---

# PluginContextAccessors

The `PluginContextAccessors` instance is available through the [PluginContext.accessors](/core/2/framework/classes/plugin-context#accessors) property.

It contains various instantiated classes and methods thats allows to interact with Kuzzle.

## `sdk`

This property is an instance of the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk).  

| Type     | Description            |
|----------|------------------------|
| <pre>[EmbeddedSDK](/core/2/framework/classes/embedded-sdk)</pre> | EmbeddedSDK instance |

See also [Embedded SDK](/core/2/guides/develop-on-kuzzle/1-embedded-sdk) guide.

## `storage`

This property is an instance of the [PluginStorage](/core/2/framework/classes/plugin-storage) class that allows to interact with the [Plugin Private Storage](/core/2/guides/some-link).  

| Type     | Description            |
|----------|------------------------|
| <pre>[PluginStorage](/core/2/framework/classes/plugin-storage)</pre> | EmbeddedSDK instance |

See also [Plugin Private Storage](/core/2/guides/some-link) guide.

## `strategies`

This property is an instance of the [PluginStrategy](/core/2/framework/classes/plugin-strategies) class that allows to dynamically add and remove [Authentication Strategy](/core/2/guides/some-link).  

| Type     | Description            |
|----------|------------------------|
| <pre>[PluginStrategy](/core/2/framework/classes/plugin-strategies)</pre> | PluginStrategy instance |

## `subscription`

This property is an instance of the [Subscription](/core/2/framework/classes/subscription) class that allows to adds or removes [realtime subscriptions](/core/2/guides/main-concepts/6-realtime-engine) from the backend.  

| Type     | Description            |
|----------|------------------------|
| <pre>[Subscription](/core/2/framework/classes/subscription)</pre> | Subscription instance |
