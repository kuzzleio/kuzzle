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

const assert = require('assert');

const debug = require('../util/debug')('kuzzle:cluster');
const getIP = require('ip');

const nameGenerator = require('../util/name-generator');
const ClusterPublisher = require('./publisher');
const ClusterSubscriber = require('./subscriber');

// Handles the node logic: discovery, eviction, heartbeat, ...
// Dependencies: core:cache module must be started

class ClusterNode {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.config = kuzzle.config.cluster;
    this.heartbeatDelay = this.config.heartbeat;

    checkConfig(this.config);

    const ip = getIP.address('public', this.config.ipv6 ? 'ipv6' : 'ipv4');
    this.address = `tcp://${ip}:${this.config.ports.sync}`;

    this.nodeId = null;
    this.nodeIdKey = null;
    this.heartbeatTimer = null;
    this.publisher = null;

    // Map.<remoteNodeId: string, subscriber: ClusterSubscriber>
    this.remoteNodes = new Map();
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

    for (const subscriber of this.remoteNodes.values()) {
      subscriber.dispose();
    }

    await this.publisher.send('NodeShutdown', { nodeId: this.nodeId });
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

  /**
   * Adds a new remote node, and subscribes to it.
   * @param {string} id            - remote node ID
   * @param {string} address       - remote node address
   * @param {number} lastMessageId - remote node last message ID
   */
  async addNode (id, address, lastMessageId) {
    if (this.remoteNodes.has(id)) {
      return;
    }

    const subscriber = new ClusterSubscriber(id, address, lastMessageId);

    this.remoteNodes.set(id, subscriber);
    subscriber.listen();
  }

  /**
   * Evicts a remote from the list
   * @param {string} nodeId - remote node ID
   * @param {Object} [options]
   * @param {boolean} [options.broadcast] - broadcast the eviction to the cluster
   * @param {string} [options.reason] - reason of eviction
   */
  async evictNode (nodeId, { broadcast, reason = '' }) {
    const subscriber = this.remoteNodes.get(nodeId);

    if (!subscriber) {
      return;
    }

    this.kuzzle.log.warn(`[CLUSTER] Node "${nodeId}" evicted. Reason: ${reason}`);
    this.remoteNodes.delete(nodeId);
    subscriber.dispose();

    if (broadcast) {
      await this.publisher.send('NodeEvicted', {
        evictor: this.nodeId,
        nodeId,
        reason,
      });
    }
  }
}

function name2key (name) {
  return `cluster/node/${name}`;
}

function checkConfig (config) {
  for (const prop of ['heartbeat', 'joinTimeout', 'minimumNodes']) {
    assert(
      typeof config[prop] === 'number' && config[prop] > 0,
      `[FATAL] kuzzlerc.cluster.${prop}: value must be a number greater than 0`);
  }

  for (const prop of ['request', 'sync']) {
    assert(
      typeof config.ports[prop] === 'number' && config.ports[prop] > 0,
      `[FATAL] kuzzlerc.cluster.ports.${prop}: value must be a number greater than 0`);
  }

  assert(typeof config.ipv6 === 'boolean', '[FATAL] kuzzlerc.cluster.ipv6: boolean expected');
}

module.exports = ClusterNode;
