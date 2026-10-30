"use strict";

// A storage driver declaring no optional capability, for the functional suite
// (ADR-0003 step 04): the test cluster's built-in Elasticsearch driver, under
// a manifest that declares none of its capabilities. Kuzzle then rejects the
// requests needing one, and the suite skips the scenarios tagged with it.
//
// Mounted as `/node_modules/kuzzle-storage-core-only` by
// .ci/test-cluster-core-only-driver.yml, out of the checkout's own
// `node_modules`, which `npm ci` empties. Kuzzle runs from the checkout.

const path = require("node:path");

const { builtInStorageDriver } = require(
  path.join(process.cwd(), "lib/service/storage/builtInDrivers"),
);

module.exports = builtInStorageDriver(
  process.env.kuzzle_services__storageEngine__majorVersion || "7",
);
