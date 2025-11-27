import rc from "rc";

import { loadConfig } from "../../lib/config";

module.exports = rc("kuzzle", {
  host: "localhost",
  port: 7512,
  scheme: "http",
  services: {
    storageEngine: {
      commonMapping: loadConfig().services.storageEngine.commonMapping,
    },
  },
});
