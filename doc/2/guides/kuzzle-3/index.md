---
code: false
type: page
order: 670
title: Towards Kuzzle 3 | Guide | Core
meta:
  - name: description
    content: What Kuzzle 3 will change, and what you can do in Kuzzle 2 to be ready
  - name: keywords
    content: Kuzzle, Documentation, Kuzzle 3, v3, breaking changes, deprecations, migration
---

# Towards Kuzzle 3

Kuzzle 3 has no release date yet. This page tells you what it will change, so that you can get ready while you are still on Kuzzle 2.

## The rule in Kuzzle 2

Kuzzle 2 takes **no breaking change**. When something should be removed or fixed in a way that would break existing projects, Kuzzle 2 keeps it working, marks it deprecated where it can, and puts it on the Kuzzle 3 list. Your Kuzzle 2 project keeps working with every 2.x release.

Most of what Kuzzle 3 removes already has a replacement in Kuzzle 2. If you move to the replacements now, upgrading to Kuzzle 3 will be much easier. The tables below give each replacement.

## The main changes

### Storage engines become installable drivers

Since 2.61, Kuzzle runs on a storage engine through a _driver_, and can load a driver installed as a separate package (see [Storage Drivers](/core/2/guides/main-concepts/data-storage#storage-drivers)). In Kuzzle 2, Elasticsearch 7 and 8 are driver packages that Kuzzle depends on and installs with itself ([`kuzzle-storage-es-7`](/drivers/storage-es-7/1/), [`kuzzle-storage-es-8`](/drivers/storage-es-8/1/)). Kuzzle 3 drops them from its dependencies: you install the one you need next to Kuzzle, like any other driver. This keeps the core smaller.

In Kuzzle 2, Elasticsearch 7 and 8 keep working exactly as they do today, selected by `services.storageEngine.majorVersion`. That option is deprecated: Kuzzle 3 selects the storage engine with `services.storageEngine.driver` only. There is nothing to change in Kuzzle 2. To get ready, you can already add your driver to your application and select it by name, as its [Getting started](/drivers/storage-es-8/1/getting-started/) page shows.

### Kuzzle's types no longer come from the SDK

Kuzzle still re-exports parts of the JavaScript SDK. Kuzzle 3 will stop re-exporting the SDK's client classes, and Kuzzle's types will come only from [`kuzzle-types`](https://github.com/kuzzleio/types) (already the case for the API contract types since 2.58).

### Deprecated features are removed

Everything marked deprecated in this documentation (look for the deprecated badge) is removed in Kuzzle 3.

## What you can do now

### Plugins and applications

| Deprecated in Kuzzle 2                                                               | Use instead                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `Mutex`, `context.constructors.Mutex`                                                | [`withLock`](/core/2/framework/functions/with-lock)                           |
| `Kuzzle`, `WebSocket`, `Http`, `KuzzleAbstractProtocol` imported from `kuzzle`       | Import them from `kuzzle-sdk`; on the server, use `app.sdk`                   |
| `KuzzleDocument` type                                                                | `KDocument`                                                                   |
| `Document`, `DocumentContent`, `DocumentMetadata`, `DocumentHit` types               | `KDocument`, `KDocumentContent`…                                              |
| `EventHandler` type                                                                  | `HookEventHandler`, `PipeEventHandler`, `ClusterEventHandler`                 |
| A hook or pipe handler given as a method name (a string)                             | A function                                                                    |
| `request.setResult()`                                                                | `request.response.configure({ result })`                                      |
| `request.getArrayLegacy()`                                                           | `request.getArrayOrCsv()`                                                     |
| `request.input.resource`, `request.input.headers`                                    | `request.input.args`, `request.context.connection.misc.headers`               |
| `request.context.connectionId`, `request.context.protocol`                           | `request.context.connection.id`, `request.context.connection.protocol`        |
| `context.accessors.execute`                                                          | `context.accessors.sdk`                                                       |
| `context.constructors.Koncorde`, `RequestContext`, `RequestInput`                    | Import them from `kuzzle`                                                     |
| `context.errors`, `context.errorsManager`, `context.log`                             | `context.kerror`, `context.logger`                                            |
| Plugin `controllers` and `routes` objects, `route.url`, the `/_plugin/<name>/…` URLs | The plugin `api` object, `route.path`                                         |
| `app.config.set()`, `app.config.merge()`                                             | `app.config.content`                                                          |
| `logger.verbose()`, `logger.silly()`                                                 | Another log level                                                             |
| `InternalLogger`                                                                     | `Logger` (`app.log`, `context.logger`)                                        |
| The `Koncorde` class exported by `kuzzle` (Koncorde 3 interface)                     | The [`koncorde`](https://www.npmjs.com/package/koncorde) package (Koncorde 4) |
| `app.sdk.auth.login()`                                                               | Impersonation (`app.sdk.as(user)`)                                            |
| `Protocol.init(name, entryPoint)`                                                    | `name` in the constructor, `init(entryPoint)`                                 |

### API clients

| Deprecated in Kuzzle 2                                                    | Use instead                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| The legacy `auth` HTTP routes (`/users/_me`, `/_updateSelf`…)             | The `/_me…` routes                                       |
| `server:getStats`, `getLastStats`, `getAllStats`                          | `server:metrics` (`/_metrics`)                           |
| `GET /_publicApi`, `DELETE /_mdelete`, `PUT /:index/:collection/_mapping` | `GET /_openapi`, `DELETE /_mDelete`, `collection:update` |
| The `PUT` forms of `document:update`, `upsert`, `mUpdate`                 | `PATCH` or `POST`                                        |
| `collection:updateMapping`                                                | `collection:update`                                      |
| The `roles` body property of `security:searchProfiles`                    | `query`                                                  |
| The `ids` in the `document:deleteByQuery` response                        | Its `documents` array                                    |
| The `memoryStorage` alias in role rights                                  | `ms`                                                     |
| `realtime:validate`                                                       | `document:validate`                                      |

Kuzzle 3 also plans to make multi-document actions (`document:mCreate`, `mUpdate`, `mDelete`, `bulk:import`…) fail when none of the documents could be written, and to forbid `@` at the start of index and collection names.

### Events

| Deprecated in Kuzzle 2                                            | Use instead                                  |
| ----------------------------------------------------------------- | -------------------------------------------- |
| The pipe `notify:dispatch`                                        | `core:realtime:notification:dispatch:before` |
| `core:hotelClerk:addSubscription`                                 | `core:realtime:user:subscribe:after`         |
| `core:hotelClerk:removeRoomForCustomer`                           | `core:realtime:user:unsubscribe:after`       |
| `room:new`                                                        | `core:realtime:room:create:after`            |
| `room:remove`                                                     | `core:realtime:room:remove:before`           |
| `kuzzle:start`, `core:kuzzleStart`                                | `kuzzle:state:ready`                         |
| `core:shutdown`                                                   | `kuzzle:shutdown`                            |
| `http:GET` (the event of a route declared with an uppercase verb) | `http:get`                                   |

### Configuration

| Deprecated in Kuzzle 2                 | Use instead                      |
| -------------------------------------- | -------------------------------- |
| `security.jwt`                         | `security.authToken`             |
| The Redis `database` option            | `options.db`                     |
| `plugins["kuzzle-plugin-logger"]`      | `server.logs`                    |
| `plugins.common.pipeTimeout`           | — (no longer used)               |
| `server.protocols.websocket.heartbeat` | — (ignored already)              |
| `realtime.pcreSupport`                 | —                                |
| `http.routes[].url`                    | `http.routes[].path`             |
| The `kuzzle-plugin-cluster` plugin     | Nothing: the cluster is built in |

## Still under discussion

Some other changes are being considered for Kuzzle 3 and are not decided yet: the true nullability of a few public TypeScript signatures, the default of `vault.newAlgorithm`, `security.authToken.gracePeriod` taking precedence over `security.jwt.gracePeriod`, a few public exports that were never documented (`ObjectRepository`, `Store`, `Connection`…) becoming internal, the response shape of a few `security` actions, and the Redis and MQTT connection defaults of the new library versions. This page will say so once they are decided.
