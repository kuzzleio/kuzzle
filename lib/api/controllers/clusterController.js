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

const { NativeController } = require("./baseController");

class ClusterController extends NativeController {
  constructor() {
    super(["status"]);
  }

  async status() {
    return global.kuzzle.ask("cluster:status:get");
  }

  async nodeAdd(nodeId, nodeIp) {
    await this.ask("cluster:node:add", nodeId, nodeIp);

    global.kuzzle.log.info(`[CLUSTER] added node "${nodeId}" (${nodeIp})`);
  }

  async nodeRemove(nodeId) {
    await this.ask("cluster:node:remove", nodeId);

    global.kuzzle.log.info(`[CLUSTER] removed node "${nodeId}"`);
  }

  async reset() {
    await this.ask("cluster:reset");

    global.kuzzle.log.info("[CLUSTER] cluster configuration reset");
  }
}

module.exports = ClusterController;
