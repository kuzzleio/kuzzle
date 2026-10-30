/**
 * The conformance kit, registered the way a driver repository registers it
 * (ADR-0003 step 04): with vitest's functions, and the capabilities its
 * manifest declares.
 */

import { afterAll, beforeAll, describe, it } from "vitest";

import { describeStorageDriverConformance } from "kuzzle";
import type { StorageDriverConformanceOptions } from "kuzzle";

import { Driver, manifest } from "./storageDriver";

const options: StorageDriverConformanceOptions = {
  Driver,
  capabilities: manifest.capabilities,
  config: { client: { node: "http://localhost:9200" } },
  indexPrefix: "memory",
  test: { afterAll, beforeAll, describe, it },
};

describeStorageDriverConformance(options);
