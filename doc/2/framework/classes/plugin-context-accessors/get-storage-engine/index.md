---
code: true
type: page
title: getStorageEngine | Framework | Core

description: PluginContextAccessors class getStorageEngine() method
---

# getStorageEngine

<SinceBadge version="2.61.0" />

Tells which storage engine Kuzzle runs on: the [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers) package, the engine family and the engine server's version.

The API of the client [context.constructors.ESClient](/core/2/framework/classes/plugin-context-constructors/properties#esclient) builds follows the driver: choose it from `driver`, not from `services.storageEngine.majorVersion`, which is ignored when `services.storageEngine.driver` is set and still holds `"7"` by default.

::: info
It asks the storage engine: call it once (e.g. in the plugin's `init()` method), not on every request.
:::

```ts
getStorageEngine(): Promise<StorageEngineInfo>
```

<br/>

## Returns

Returns a Promise resolving to a `StorageEngineInfo` object (exported by `kuzzle`):

| Property  | Type              | Description |
| --------- | ----------------- | ----------- |
| `driver`  | <pre>string</pre> | The driver's npm package name: `kuzzle-storage-es-7` or `kuzzle-storage-es-8` for the built-in drivers, the package `services.storageEngine.driver` names otherwise (e.g. `kuzzle-storage-es-9`) |
| `engine`  | <pre>string</pre> | The engine family, as the driver reports it (e.g. `elasticsearch`) |
| `version` | <pre>string</pre> | The engine server's version (e.g. `9.0.8`) |

## Usage

```js
async init(config, context) {
  const { driver } = await context.accessors.getStorageEngine();

  // The built-in Elasticsearch 8 driver and the Elasticsearch 9 one give a
  // client taking `document` instead of `body`, with flat responses
  this.flatClient = ['kuzzle-storage-es-8', 'kuzzle-storage-es-9'].includes(driver);
}
```
