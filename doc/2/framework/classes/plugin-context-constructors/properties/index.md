---
code: false
type: page
title: Properties
description: PluginContextConstructors class properties
---

# PluginContextConstructors

The `PluginContextConstructors` instance is available through the [PluginContext.constructors](/core/2/framework/classes/plugin-context#constructors) property.

It contains various classes thats allows to interact with Kuzzle.

## `BaseValidationType`

Abstract class that allows to define a new custom type for the [Data Validation](/core/2/guides/some-link) module.

## `ESClient`

This constructor instantiates an embedded [Elasticsearch client](https://github.com/elastic/elasticsearch-js) with the same configuration as the one provided in Kuzzle configuration.  

This client can be used to send raw Elasticsearch request.  

See [Elasticsearch official documentation](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) for more information.

### Arguments

This class constructor takes no argument.

**Usage:**

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
const esClient = new app.storage.Client()
await esClient.index(esRequest)
```

## `Koncorde`

<DeprecatedBadge version="change-me" />

Instantiates a new [Koncorde](/core/2/framework/classes/koncorde) engine.

::: info
The `Koncorde` class should be imported from the `kuzzle` package.

```js
import { Koncorde } from 'kuzzle';
```
:::

## `Repository`

Instantiates a new [Repository](/core/2/framework/classes/repository).

See the [Plugin Private Storage](/core/2/guides/some-link) guide.

## `Request`

Modified [Request](/core/2/framework/classes/request) constructor that allows to instantiate a new `Request` with the context (user, jwt, connection) of another one.

### Arguments

```ts
Request(originalRequest: Request, requestPayload: RequestPayload, options: JSONObject): Request
```

<br/>

| Arguments | Type              | Description                                     |
| --------- | ----------------- | ----------------------------------------------- |
| `originalRequest` | <pre>Request</pre> | Original request of which we will use the context |
| `requestPayload` | <pre>[RequestPayload](/core/2/framework/types/request-payload)</pre> | New request payload |
| `options` | <pre>JSONObject</pre> | Additional options passed to the [RequestContext](/core/2/framework/classes/request-context) constructor |


**Usage:**

```js
const req = new context.constructors.Request(request, {
  controller: 'auth',
  action: 'getCurrentUser'
})

const user = await context.accessors.execute(req) 
```

## `ESClient`

Constructor for [Elasticsearch SDK Client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html).

**Usage:**

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
const esClient = new app.storage.Client()
await esClient.index(esRequest)
```