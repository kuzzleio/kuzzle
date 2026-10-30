---
code: false
type: page
order: 100
title: Start writing a storage driver | Write storage drivers | Guide
meta:
  - name: description
    content: The package layout and the first steps of a Kuzzle storage driver
  - name: keywords
    content: Kuzzle, Documentation, storage driver, manifest, package
---

# Start Writing a Storage Driver

<SinceBadge version="2.61.0" />

Kuzzle stores its data through a **storage driver**: an npm package that exports a class implementing Kuzzle's
`StorageDriver` contract. The application selects it in its configuration, and Kuzzle loads it at startup, before
anything else uses the storage. The Elasticsearch 7, 8 and 9 drivers are built this way (see the
[Drivers](/drivers/v2.html) section); writing another one lets Kuzzle run on another engine, with the same API.

::: info
The public API does not change with the driver: queries, mappings and search bodies stay in the Elasticsearch format,
which each driver translates. A driver for an engine of the Elasticsearch family (OpenSearch...) can translate it all;
another engine can implement a subset, and declare it (see [Capabilities](/core/2/guides/write-storage-drivers/contract#capabilities)).
:::

## The package

A driver is an ordinary npm package, named `kuzzle-storage-<engine>-<major>` by convention (`kuzzle-storage-es-9`,
`kuzzle-storage-opensearch-2`):

```
kuzzle-storage-myengine-1/
├── package.json
├── manifest.json       # read by Kuzzle before it loads the code
└── dist/index.js       # exports the driver class
```

`package.json` declares `kuzzle` as a **peer dependency**, never as a dependency: the driver must use the running
Kuzzle's classes, its error classes in particular.

```json
{
  "name": "kuzzle-storage-myengine-1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "manifest.json"],
  "peerDependencies": {
    "kuzzle": ">=2.61.0-0 <3"
  },
  "devDependencies": {
    "kuzzle": "2.61.0"
  }
}
```

`manifest.json`, at the package root, states the Kuzzle versions the driver supports and the optional features it
implements:

```json
{
  "kuzzleVersion": ">=2.61.0-0 <3",
  "capabilities": ["aggregations", "stats"]
}
```

| Field | What it is |
| --- | --- |
| `kuzzleVersion` | A semver range. Kuzzle refuses to start when its version is out of it: this is the only versioning of the contract. |
| `capabilities` | The optional capability groups the driver implements: `aggregations`, `mappingUpdates`, `stats`, `updateByQuery`. |

## The driver class

The package exports the class, as its module or as its `default` export. In TypeScript:

```ts
import {
  type JSONObject,
  type StorageDriver,
  type StorageEngineElasticsearch,
  storeScopeEnum,
} from "kuzzle";

import { Client } from "my-engine-client";

export class MyEngineDriver implements StorageDriver {
  // Builds a new engine client, for app.storage.storageClient and the plugins
  static createNativeClient(clientConfig: JSONObject): Client {
    return new Client(clientConfig);
  }

  private client: Client | null = null;

  constructor(
    private readonly config: StorageEngineElasticsearch,
    private readonly scope: storeScopeEnum,
  ) {}

  async init(): Promise<void> {
    this.client = MyEngineDriver.createNativeClient(this.config.client);
    // connect, create what the engine needs...
  }

  // ...the rest of the contract
}

export default MyEngineDriver;
```

The [contract](/core/2/guides/write-storage-drivers/contract) lists what the class implements.

## Try it in an application

Pack the driver and install the tarball next to `kuzzle`, then select it:

```bash
cd kuzzle-storage-myengine-1 && npm pack
cd ../my-application && npm install ../kuzzle-storage-myengine-1/kuzzle-storage-myengine-1-1.0.0.tgz
```


```jsonc
{
  "services": {
    "storageEngine": {
      "driver": "kuzzle-storage-myengine-1",
      "client": { "node": "http://localhost:9200" }
    }
  }
}
```

Kuzzle resolves the package from the application's directory, checks its manifest, loads it and logs
`[ℹ] Storage driver: kuzzle-storage-myengine-1@<version>`. Every key of `services.storageEngine` is handed to the
driver's constructor.

::: warning
A driver installed from a directory (`npm link`, or `npm install ../my-driver`, which links it too) resolves `kuzzle`
from its own location, and gets another copy of Kuzzle than the running one: the errors it throws are then not
recognized. Install a packed tarball, as above, or the published package.
:::
