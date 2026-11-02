"use strict";

// The copy of `kuzzle` npm installs for an external storage driver's peer
// dependency when Kuzzle is itself the application (its repository, its
// Docker image), standing in for a stale one: Kuzzle must hand the driver the
// running Kuzzle instead (kuzzle#3132), so this file must never run. If it
// does, the driver gets other error classes than the ones Kuzzle checks with
// `instanceof`, and the test cluster refuses to start rather than answering
// 500 where a 404 is expected.
// The .ci/test-cluster-<driver>-driver.yml overlays put it at /node_modules/kuzzle.
throw new Error(
  "A storage driver loaded a copy of kuzzle instead of the running Kuzzle (kuzzle#3132)",
);
