---
type: page
code: false
title: Core | Framework | Core

description: Core events list
order: 100
---

# Core Events

Kuzzle triggers many `core:*` events for its internal use. Only events listed here should be used.

::: warning
Use non-documented events at your own risk, we may remove them or change the payload without warning.
:::

## core:auth:strategyAdded

| Arguments  | Type              | Description                         |
| ---------- | ----------------- | ----------------------------------- |
| `strategy` | <pre>object</pre> | Authentication strategy information |

Triggered whenever a plugin [dynamically registers](/core/2/guides/write-plugins/integrate-authentication-strategy) an authentication strategy.

---

## strategy

The provided `strategy` object has the following properties:

| Properties   | Type              | Description                                                                                                         |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pluginName` | <pre>string</pre> | The plugin's name defined in the [manifest file](/core/2/guides/write-plugins/start-writing-plugins#manifest-json) |
| `name`       | <pre>string</pre> | Authentication strategy name                                                                                        |
| `strategy`   | <pre>object</pre> | Authentication [strategy properties](/core/2/framework/types/strategy-definition)           |

## core:auth:strategyRemoved

| Arguments  | Type              | Description                         |
| ---------- | ----------------- | ----------------------------------- |
| `strategy` | <pre>object</pre> | Authentication strategy information |

Triggered whenever a plugin [dynamically removes](/core/2/guides/write-plugins/integrate-authentication-strategy) an authentication strategy.

---

## strategy

The provided `strategy` object has the following properties:

| Properties   | Type              | Description                                                                                                         |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pluginName` | <pre>string</pre> | The plugin's name defined in the [manifest file](/core/2/guides/write-plugins/start-writing-plugins#manifest-json) |
| `name`       | <pre>string</pre> | Authentication strategy name                                                                                        |

## core:kuzzleStart

<DeprecatedBadge version="2.2.0" />

This event is deprecated, and may be removed in a future version of Kuzzle.
Use [kuzzle:state:ready](/core/2/framework/events/kuzzle#kuzzle-state-ready) instead (its first replacement, `kuzzle:start`, is itself deprecated since 2.3.0).

Triggered when Kuzzle has finished booting and is ready to process user requests.

:::info
Pipes cannot listen to that event, only hooks can.
:::

## core:overload



| Arguments | Type              | Description                    |
| --------- | ----------------- | ------------------------------ |
| `fill`    | <pre>number</pre> | Request buffer fill percentage |

Triggered when the requests buffer fills up more quickly than requests can be processed.

The requests buffer is configurable through the `limits` parameters in the [Kuzzle configuration](/core/2/guides/advanced/configuration).

Requests submitted while the request buffer is completely filled (i.e. the payload is equal to `100`) are rejected with a [ServiceUnavailableError](/core/2/api/errors/types#common-errors) (code `503`)

:::info
Pipes cannot listen to that event, only hooks can.
:::

## log:error

| Arguments | Type                                                         | Description                 |
| --------- | ------------------------------------------------------------ | --------------------------- |
| `error`   | <pre><a href=/core/2/framework/error-classes/service-unavailable-error>ServiceUnavailableError</a></pre> | The overload error |

Triggered when a request is rejected because the requests buffer is full (see [core:overload](#core-overload)).

:::info
Pipes cannot listen to that event, only hooks can.
:::

## core:storage:collection:reindex:start

<SinceBadge version="2.62.0" />

| Arguments | Type              | Description                                    |
| --------- | ----------------- | ---------------------------------------------- |
| `payload` | <pre>object</pre> | The collection and the reindex task it started |

Triggered when a mapping update starts a background reindex of a collection's documents, with the storage engine's id of that task: a [collection:update](/core/2/api/controllers/collection/update) with `reindexCollection`, or a change the engine can only apply to existing documents by reindexing them, such as `dynamic`.

The event is emitted on the node that ran the update, before the API request that started it is answered. The reindex itself is still running: follow it with the storage engine's task API.

Only storage drivers telling the task's id trigger it: with a driver that does not, the reindex still runs, but the event is not emitted. The API response does not change.

### payload

| Properties   | Type              | Description                                                         |
| ------------ | ----------------- | ------------------------------------------------------------------- |
| `scope`      | <pre>string</pre> | `public` for the API's indexes, `private` for Kuzzle's internal ones |
| `index`      | <pre>string</pre> | Index name                                                          |
| `collection` | <pre>string</pre> | Collection name                                                     |
| `taskId`     | <pre>string</pre> | The storage engine's id of the reindex task (e.g. `nodeId:1234`)    |

```js
app.hook.register(
  "core:storage:collection:reindex:start",
  ({ scope, index, collection, taskId }) => {
    // e.g. GET _tasks/<taskId> to follow it
  },
);
```

:::info
Pipes cannot listen to that event, only hooks can.
:::

## core:shutdown

<DeprecatedBadge version="2.2.0" />

This event is deprecated and is now an alias for [kuzzle:shutdown](/core/2/framework/events/kuzzle#kuzzle-shutdown).

It will be removed in a future version.
