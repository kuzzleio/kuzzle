---
code: true
type: page
title: getEngine | Framework | Core

description: BackendStorage class getEngine() method
---

# getEngine

<SinceBadge version="2.61.0" />

Tells which storage engine Kuzzle runs on: the [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers) package, the engine family and the engine server's version.

The API of the [storageClient and StorageClient](/core/2/framework/classes/backend-storage/properties) clients follows the driver: choose it from `driver`, not from `services.storageEngine.majorVersion`, which is ignored when `services.storageEngine.driver` is set and still holds `"7"` by default.

::: info
This method can only be used once the application is started.
It asks the storage engine: call it once, not on every request.
:::

```ts
getEngine(): Promise<StorageEngineInfo>
```

<br/>

## Returns

Returns a Promise resolving to a `StorageEngineInfo` object (exported by `kuzzle`):

| Property  | Type              | Description |
| --------- | ----------------- | ----------- |
| `driver`  | <pre>string</pre> | The driver's npm package name: `kuzzle-storage-es-7` or `kuzzle-storage-es-8` for the built-in drivers, the package `services.storageEngine.driver` names otherwise (e.g. `kuzzle-storage-es-9`) |
| `engine`  | <pre>string</pre> | The engine family, as the driver reports it (e.g. `elasticsearch`) |
| `version` | <pre>string</pre> | The engine server's version (e.g. `9.0.8`) |

## Errors

- [plugin.runtime.unavailable_before_start](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime): the application is not started yet

## Usage

```js
const { driver, engine, version } = await app.storage.getEngine();

app.log.info(`Storage: ${engine} ${version}, through ${driver}`);
```
