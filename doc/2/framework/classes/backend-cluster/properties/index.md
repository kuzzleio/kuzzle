---
code: false
type: page
title: Properties | Framework | Core

description: BackendCluster class properties
---

# BackendCluster

<SinceBadge version="2.9.0" />

The `BackendCluster` class handles cluster interactions.

It is accessible from the [Backend.cluster](/core/2/framework/classes/backend/properties#cluster) property.

Its methods rely on the cluster module, which only runs once the application is started: they can only be used once [app.start()](/core/2/framework/classes/backend/start) has resolved (or in a handler of the `kuzzle:state:ready` event).
They also need the cluster to be enabled (`cluster.enabled`, `true` by default): otherwise they reject with a `core.fatal.assertion_failed` error.

::: info
This class does not have any properties.
:::
