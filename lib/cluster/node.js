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

const debug = require('../util/debug')('kuzzle:cluster');
const getIP = require('ip');

const nameGenerator = require('../util/name-generator');
const ClusterPublisher = require('./publisher');

// Handles the node logic: discovery, eviction, heartbeat, ...
// Dependencies: core:cache module must be started

class ClusterNode {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.config = kuzzle.config.cluster;
    this.heartbeatDelay = 2000;

    const ip = getIP.address('public', this.config.ipv6 ? 'ipv6' : 'ipv4');
    this.address = `tcp://${ip}:${this.config.ports.sync}`;

    this.nodeId = null;
    this.nodeIdKey = null;
    this.heartbeatTimer = null;
    this.publisher = null;
  }

  async init () {
    this.nodeId = await this.generateId();
    this.nodeIdKey = name2key(this.nodeId);
    this.publisher = new ClusterPublisher(this);

    this.startHeartbeat();
    this.kuzzle.on('kuzzle:shutdown', () => this.shutdown());

    return this.nodeId;
  }

  /**
   * Heartbeat method.
   * 1. Refreshes this node key to prevent it from expiring by itself
   * 2. Sends an heartbeat packet to other nodes to let them know that we still
   *    live
   */
  async startHeartbeat () {
    this.heartbeatTimer = setInterval(
      async () => {
        await this.kuzzle.ask(
          'core:cache:internal:expire',
          this.nodeIdKey,
          this.heartbeatDelay * 1.5);

        await this.publisher.send('Heartbeat', { address: this.address });
      },
      this.heartbeatDelay);
  }

  /**
   * Shutdown event: clears all timers, sends a termination status to other
   * nodes, and removes entries from the cache
   */
  async shutdown () {
    debug('[%s] Removing myself from the cluster...', this.nodeId);
    clearInterval(this.heartbeatTimer);
    await this.kuzzle.ask('core:cache:internal:del', this.nodeIdKey);
    await this.publisher.send('NodeRemoval', { id: this.nodeId });
    await this.publisher.dispose();
  }

  /**
   * Generates and reserves a unique ID for this node instance.
   * Makes sure that the ID is not already taken by another node instance.
   *
   * @return {string} node unique ID
   */
  async generateId () {
    let name;
    let reserved;

    do {
      name = nameGenerator();

      reserved = await this.kuzzle.ask(
        'core:cache:internal:store',
        name2key(name),
        this.address,
        { onlyIfNew: true, ttl: this.heartbeatDelay * 1.5 });
    } while (!reserved);

    return name;
  }
}

function name2key (name) {
  return `cluster/node/${name}`;
}

module.exports = ClusterNode;
