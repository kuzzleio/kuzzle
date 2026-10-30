import { createRequire } from "node:module";
import * as path from "node:path";

const nodeRequire = createRequire(__filename);

/**
 * The Elasticsearch `Client` class the built-in driver of a major version
 * builds its native clients with: the copy its package depends on, not
 * Kuzzle's `sdk-es7` / `sdk-es8`.
 */
export function builtInDriverClient(majorVersion: "7" | "8"): unknown {
  const driverPackage = nodeRequire.resolve(
    `kuzzle-storage-es-${majorVersion}`,
  );

  return nodeRequire(
    nodeRequire.resolve("@elastic/elasticsearch", {
      paths: [path.dirname(driverPackage)],
    }),
  ).Client;
}
