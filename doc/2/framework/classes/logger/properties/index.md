---
code: false
type: page
title: Properties | Framework | Core
description: Logger class properties
---

# Logger

<SinceBadge version="2.45.0" />

The `Logger` class is the application logger. It is based on [kuzzle-logger](https://www.npmjs.com/package/kuzzle-logger), which uses [pino](https://getpino.io).

It is accessible from the [Backend.log](/core/2/framework/classes/backend/properties#log) property. Plugins get a child of the Kuzzle logger through the [PluginContext.logger](/core/2/framework/classes/plugin-context/properties#logger) property.

::: info
Before Kuzzle 2.45.0, `Backend.log` was an [InternalLogger](/core/2/framework/classes/internal-logger). The `debug`, `info`, `warn` and `error` methods keep their name, so most code needs no change.
:::

::: info
The class itself is not exported by the `kuzzle` package. In TypeScript, use `Backend["log"]` to name its type.
:::

Logs are written by the transports set in the `server.appLogs` section of the [configuration](/core/2/guides/advanced/configuration) (`stdout` by default, initial level `info`). Unlike `InternalLogger`, the logger is usable before the application is started.

Each log line carries the logger's `namespace` (`kuzzle:app` for `app.log`), the `failsafeMode` flag and, once the node has an identifier, its `nodeId`.

## `level`

Current log level. Set it to change the level at runtime.

| Type              | Get / Set | Description                                                        |
|-------------------|-----------|--------------------------------------------------------------------|
| <pre>string</pre> | get / set | `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`     |

A child logger (see [child](/core/2/framework/classes/logger/child)) follows the level of its parent until its own level is set.

### Usage

```js
app.log.level = 'debug';
```
