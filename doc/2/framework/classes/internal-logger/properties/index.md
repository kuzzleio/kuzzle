---
code: false
type: page
title: Properties | Framework | Core

description: InternalLogger class properties
---

# InternalLogger

<DeprecatedBadge version="2.60.0" />

::: warning
`InternalLogger` is deprecated: use [Logger](/core/2/framework/classes/logger), the type of [Backend.log](/core/2/framework/classes/backend/properties#log), instead.
:::

The `InternalLogger` class allows developers to use Kuzzle's internal logger.

::: warning
Since Kuzzle 2.45.0, [Backend.log](/core/2/framework/classes/backend/properties#log) is no longer an `InternalLogger`: it is a [Logger](/core/2/framework/classes/logger). The `InternalLogger` class is still exported by the `kuzzle` package, but Kuzzle no longer creates any instance of it.
:::

Before application startup, its methods use `console.log` instead of the configured logger.

See the [Internal Logger](/core/2/guides/advanced/internal-logger) guide.

::: info
This class does not have any properties.
:::
