---
code: false
type: page
title: Properties
description: BackendStorage class properties
---

# BackendStorage

The `BackendStorage` class allows to interact directly with Elasticsearch.  

It is accessible from the [Backend.storage](/core/2/framework/classes/backend/properties#storage) property.

See the [Data Storage](/core/2/guides/main-concepts/data-storage#integrated-elasticsearch-client) guide.

## `storageClient`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[Client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html)</pre> | Lazily instantiated Elasticsearch Node.js client | get |

## Usage

```js
const esRequest =  {
  body: {
    name: 'Aschen',
    age: 27
  },
  index: '&nyc-open-data.yellow-taxi',
  op_type: 'create'
}

await app.storage.client.index(esRequest)
```

## `StorageClient`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>new (clientConfig?: any) =&gt; Client</pre> | Storage client constructor | get |

::: info
By default, the instantiated client uses the same configuration than the one used by Kuzzle.  
It's possible to overload the client configuration by passing the `clientConfig` argument to the constructor.
:::

## Usage

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
const storageClient = new app.storage.Client()
await storageClient.index(esRequest)
```
