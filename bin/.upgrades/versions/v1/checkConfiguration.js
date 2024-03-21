/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const _ = require("lodash");

module.exports = async function check(context) {
  let action = false;
  const warn = (msg) => context.log.warn(`[CONFIG. FILES] ${msg}`);
  const renamed = {
    "services.db": "services.storageEngine",
    "services.internalEngine": "services.internalIndex",
    "services.storageEngine.commonMapping._kuzzle_info":
      "services.storageEngine.commonMapping.properties._kuzzle_info",
    "services.storageEngine.dynamic":
      "services.storageEngine.commonMapping.dynamic",
  };
  const deprecated = [
    "server.entryPoints",
    "server.protocols.socketio",
    "server.proxy",
    "services.garbageCollector",
    "services.storageEngine.client.apiVersion",
    "services.storageEngine.commonMapping.properties._kuzzle_info.deletedAt",
    "services.storageEngine.commonMapping.properties._kuzzle_info.active",
  ];

  for (const [oldName, newName] of Object.entries(renamed)) {
    if (_.get(context.config, oldName)) {
      action = true;
      warn(`The configuration key "${oldName}" is now named "${newName}"`);
    }
  }

  for (const name of deprecated) {
    if (_.get(context.config, name)) {
      action = true;
      warn(`The configuration key "${name}" is obsolete and should be removed`);
    }
  }

  if (action) {
    const choices = ["Check again", "Abort", "Ignore (not recommended)"],
      proceed = await context.inquire.direct({
        choices,
        default: choices[0],
        message: "Configuration files need to be updated:",
        type: "list",
      });

    if (proceed === choices[0]) {
      await context.loadConfiguration();
      return check(context);
    }

    if (proceed === choices[1]) {
      process.exit(1);
    }
  }

  context.log.ok("Configuration files checked: OK");
};
