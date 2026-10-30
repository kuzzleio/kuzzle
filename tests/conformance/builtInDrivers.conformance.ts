/* The conformance kit run against the built-in Elasticsearch 7 or 8 driver
 * (ADR-0003 step 04), which proves the kit itself. Needs a real
 * Elasticsearch: `npm run test:conformance`, with `ES_VERSION` (7 or 8) and
 * `KUZZLE_CONFORMANCE_ES_NODE` (default `http://localhost:9200`). */

import { afterAll, beforeAll, describe, it } from "vitest";

// From the package entry point, as a driver repository imports it
import {
  STORAGE_CAPABILITIES,
  describeStorageDriverConformance,
} from "../../index";
import { builtInStorageDriver } from "../../lib/service/storage/builtInDrivers";

const majorVersion = process.env.ES_VERSION === "8" ? "8" : "7";

describe(`Built-in Elasticsearch ${majorVersion} driver`, () => {
  describeStorageDriverConformance({
    Driver: builtInStorageDriver(majorVersion),
    capabilities: [...STORAGE_CAPABILITIES],
    config: {
      client: {
        node: process.env.KUZZLE_CONFORMANCE_ES_NODE ?? "http://localhost:9200",
      },
      majorVersion,
    },
    test: { afterAll, beforeAll, describe, it },
  });
});
