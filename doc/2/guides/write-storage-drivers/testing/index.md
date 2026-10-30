---
code: false
type: page
order: 400
title: Test a driver | Write storage drivers | Guide
meta:
  - name: description
    content: Test a Kuzzle storage driver with the conformance kit
  - name: keywords
    content: Kuzzle, Documentation, storage driver, conformance kit, tests
---

# Test a Driver

<SinceBadge version="2.61.0" />

## The conformance kit

`kuzzle` exports a **conformance kit**: the test suite every driver passes against its real engine. It covers the
mandatory core, and each capability the driver declares (the others are skipped). It registers its cases through your
test runner's functions: vitest's and jest's as they are, mocha's `before` / `after` as `beforeAll` / `afterAll`.

```ts
// test/conformance.test.ts
import { describeStorageDriverConformance, type StorageCapability } from "kuzzle";
import { afterAll, beforeAll, describe, it } from "vitest";

import { MyEngineDriver } from "../lib";
import manifest from "../manifest.json";

describeStorageDriverConformance({
  Driver: MyEngineDriver,
  capabilities: manifest.capabilities as StorageCapability[],
  // merged over Kuzzle's default services.storageEngine configuration
  config: { client: { node: process.env.ENGINE_NODE ?? "http://localhost:9200" } },
  test: { afterAll, beforeAll, describe, it },
});
```

| Option | What it is |
| --- | --- |
| `Driver` | The driver class, as the package exports it. |
| `capabilities` | The capabilities to test: pass the manifest's, so that the manifest is what is tested. |
| `config` | `services.storageEngine`, merged over Kuzzle's defaults. |
| `test` | The test runner's `describe`, `it`, `beforeAll`, `afterAll`. |
| `indexPrefix` | Prefix of the indexes the kit creates, then deletes (default `conformance`, plus a random suffix per run). |

The kit runs the driver outside of Kuzzle, in one process: it stands in for what a driver may use of `global.kuzzle`
(see [the contract](/core/2/guides/write-storage-drivers/contract#what-a-driver-may-use-of-kuzzle)). A driver reaching
for anything else fails there, before it fails in production.

Run it in CI against the engine, as a service container. The Elasticsearch drivers do it on every push:
[storage-es-9's workflow](https://github.com/kuzzleio/storage-es-9/blob/master/.github/workflows/ci.yaml) is a
starting point.

## Unit tests

The kit checks behaviour against a real engine; unit tests pin what it cannot reach: the requests sent for each
action, error translation, edge cases. The Elasticsearch drivers share one unit suite, with a stubbed client:
`test/unit/` in [storage-es-8](https://github.com/kuzzleio/storage-es-8/tree/beta/test/unit) shows how to run a
driver through Kuzzle's own `StorageService`, with the `kuzzle` version the driver is developed against.

## In an application

Last, run Kuzzle on the driver: start an application with `services.storageEngine.driver` set, and run your API
tests, or Kuzzle's own functional suite, against it. Every node of a cluster must run the same driver version.
