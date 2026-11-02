---
code: false
type: page
title: Properties | Framework | Core

description: BackendStorage class properties
---

# BackendStorage

<SinceBadge version="2.8.0" />

The `BackendStorage` class allows to interact directly with the storage engine (Elasticsearch by default).  

It is accessible from the [Backend.storage](/core/2/framework/classes/backend/properties#storage) property.

See the [Data Storage](/core/2/guides/main-concepts/data-storage#integrated-elasticsearch-client) guide.

## `storageClient`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>any</pre> | Lazily instantiated client of the storage engine | get |

<SinceBadge version="2.61.0" />

The client is built by the [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers) in use: the [Elasticsearch client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) of the configured version with the built-in drivers, the driver's own engine client when `services.storageEngine.driver` is set, whatever `majorVersion` says. The driver's TypeScript page (e.g. [`kuzzle-storage-es-9`](/drivers/storage-es-9/1/typescript/)) tells its API and how to type it.

## Usage

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

await app.storage.storageClient.index(esRequest)
```

## `StorageClient`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>new (clientConfig?: any) =&gt; any</pre> | Storage client constructor | get |

It builds a new client of the same kind as `storageClient`, through the storage driver in use.

::: info
By default, the instantiated client uses the same configuration than the one used by Kuzzle.  
It's possible to overload the client configuration by passing the `clientConfig` argument to the constructor.
:::

## Usage

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
const storageClient = new app.storage.StorageClient()
await storageClient.index(esRequest)
```
