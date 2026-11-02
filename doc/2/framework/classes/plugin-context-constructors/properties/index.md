---
code: false
type: page
title: Properties | Framework | Core

description: PluginContextConstructors class properties
---

# PluginContextConstructors

The `PluginContextConstructors` instance is available through the [PluginContext.constructors](/core/2/framework/classes/plugin-context/properties#constructors) property.

It contains various classes thats allows to interact with Kuzzle.

## `BaseValidationType`

Abstract class that allows to define a new custom type for the [Data Validation](/core/2/guides/advanced/data-validation) module.

## `ESClient`

This constructor instantiates a client of the storage engine, with the same configuration as the one provided in Kuzzle configuration.  

This client can be used to send raw storage requests.  

<SinceBadge version="2.61.0" />

The client is built by the [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers) in use: the [Elasticsearch client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) of the configured version with the built-in drivers, the driver's own engine client when `services.storageEngine.driver` is set, whatever `majorVersion` says. The driver's TypeScript page (e.g. [`kuzzle-storage-es-9`](/drivers/storage-es-9/1/typescript/)) tells its API and how to type it.

### Arguments

This class constructor takes no argument.

### Usage

With the Elasticsearch 7 client (also the shape of the OpenSearch drivers' client):

```js
const esRequest =  {
  body: {
    name: 'Aschen',
    age: 27
  },
  index: '&nyc-open-data.yellow-taxi',
  op_type: 'create'
}

// Instantiate and use a new client
const esClient = new context.constructors.ESClient()
await esClient.index(esRequest)
```

## `Koncorde`

<DeprecatedBadge version="2.8.0" />

Instantiates a new [Koncorde](/core/2/framework/classes/koncorde) engine.

::: info
The `Koncorde` class exported by the `kuzzle` package is itself deprecated since 2.14.0: use the [koncorde](https://www.npmjs.com/package/koncorde) package (v4) directly.

```js
import { Koncorde } from 'koncorde';
```
:::

## `Repository`

Instantiates a new [Repository](/core/2/framework/classes/repository).

## `Request`

Modified [KuzzleRequest](/core/2/framework/classes/kuzzle-request) constructor. It can instantiate a new `KuzzleRequest` with the context (user, jwt, connection) of another one, or from raw data.

### Arguments

```ts
new Request(originalRequest: KuzzleRequest, requestPayload?: RequestPayload, options?: JSONObject): KuzzleRequest
new Request(requestPayload: RequestPayload, options?: JSONObject): KuzzleRequest
```

<br/>

| Arguments | Type              | Description                                     |
| --------- | ----------------- | ----------------------------------------------- |
| `originalRequest` | <pre>KuzzleRequest</pre> | Original request of which we will use the context. The new request also inherits its `_id`, `index`, `collection` and other arguments, its `jwt` and its volatile data, unless `requestPayload` sets them |
| `requestPayload` | <pre>[RequestPayload](/core/2/framework/types/request-payload)</pre> | New request payload |
| `options` | <pre>JSONObject</pre> | Additional options passed to the [RequestContext](/core/2/framework/classes/request-context) constructor |

The constructor throws a `plugin.context.missing_request_data` error if its first argument is missing.

### Usage

```js
const req = new context.constructors.Request(request, {
  controller: 'auth',
  action: 'getCurrentUser'
})

const user = await context.accessors.execute(req) 
```

## `RequestContext`

<DeprecatedBadge version="2.8.0" />

The [RequestContext](/core/2/framework/classes/request-context) class.

::: info
The `RequestContext` class should be imported from the `kuzzle` package.

```js
import { RequestContext } from 'kuzzle';
```
:::

## `RequestInput`

<DeprecatedBadge version="2.8.0" />

The [RequestInput](/core/2/framework/classes/request-input) class.

::: info
The `RequestInput` class should be imported from the `kuzzle` package.

```js
import { RequestInput } from 'kuzzle';
```
:::

## `Mutex`
<SinceBadge version="2.17.0" />
<DeprecatedBadge version="2.57.0" />

Deprecated: use [withLock](/core/2/framework/functions/with-lock), exported by `kuzzle`, instead.

Instantiates a new mutex, allowing to lock a resource. Works both with single-node and cluster environments.

See [Mutex documentation](/core/2/framework/classes/mutex) for more information.
