"use strict";

// An external storage driver requires "kuzzle" as a peer dependency. In
// Kuzzle's own test cluster, Kuzzle is the checkout, run from its TypeScript
// sources: this hands the driver that very module graph, so that the error
// classes and the rest are the ones Kuzzle checks against.
// .ci/test-cluster-es9-driver.yml puts it at /node_modules/kuzzle.
module.exports = require("/var/app/index.ts");
