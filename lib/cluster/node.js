/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const nameGenerator = require('../util/name-generator');

// Handles the node logic: discovery, eviction, heartbeat, ...

class ClusterNode {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.nodeId = null;
    this.nodeIdKey = null;
  }

  async init () {
    this.nodeId = await this.generateId();
    this.nodeIdKey = name2key(this.nodeId);

    return this.nodeId;
  }

  /**
   * Starts the heartbeat with other nodes
   * @return {[type]} [description]
   */
  heartbeat () {
  }

  async generateId () {
    let name;
    let key;

    do {
      name = nameGenerator();
      key = name2key(name);
    } while ((await this.kuzzle.ask('core:cache:internal:get', key)) !== null);

    return name;
  }
}

function name2key (name) {
  return `cluster/node/${name}`;
}

module.exports = ClusterNode;
