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

const getIP = require('ip');
const Bluebird = require('bluebird');

const debug = require('../util/debug')('kuzzle:cluster');
const nameGenerator = require('../util/name-generator');
const Mutex = require('../util/mutex');
const ClusterPublisher = require('./publisher');
const ClusterSubscriber = require('./subscriber');
const ClusterState = require('./state');
const ClusterCommand = require('./command');
const storeScopeEnum = require('../core/storage/storeScopeEnum');

const REDIS_PREFIX = '{cluster/node}/';

// Handles the node logic: discovery, eviction, heartbeat, ...
// Dependencies: core:cache module must be started
class ClusterNode {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.config = kuzzle.config.cluster;
    this.heartbeatDelay = this.config.heartbeat;

    checkConfig(this.config);

    this.ip = getIP.address('public', this.config.ipv6 ? 'ipv6' : 'ipv4');

    this.nodeId = null;
    this.nodeIdKey = null;
    this.heartbeatTimer = null;

    this.publisher = new ClusterPublisher(this);
    this.fullState = new ClusterState(this.kuzzle);
    this.command = new ClusterCommand(this);

    /**
     * Links remote node IDs with their subscriber counterpart
     * @type {Map.<string, ClusterSubscriber>}
     */
    this.remoteNodes = new Map();
  }

  get syncAddress () {
    return `tcp://${this.ip}:${this.config.ports.sync}`;
  }

  async init () {
    // The publisher needs to be created and initialized before the handshake:
    // other nodes we'll connect to during the handshake will start to subscribe
    // to this node right away
    await this.publisher.init();

    // This also needs to be started before the handshake, as this class handles
    // direct requests to other nodes (needed to request for the full state
    // and to introduce oneself to other nodes)
    await this.command.init();

    this.kuzzle.on('kuzzle:shutdown', () => this.shutdown());

    await this.handshake();

    this.registerEvents();
    this.registerAskEvents();

    return this.nodeId;
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
    this.command.dispose();
  }

  /**
   * Generates and reserves a unique ID for this node instance.
   * Makes sure that the ID is not already taken by another node instance.
   *
   * @return {void}
   */
  async generateId () {
    let reserved;

    do {
      this.nodeId = nameGenerator();
      this.nodeIdKey = `${REDIS_PREFIX}${this.nodeId}`;

      reserved = await this.kuzzle.ask(
        'core:cache:internal:store',
        this.nodeIdKey,
        this.ip,
        { onlyIfNew: true, ttl: this.heartbeatDelay * 1.5 });
    } while (!reserved);

    this.heartbeatTimer = setInterval(
      async () => {
        await this.kuzzle.ask(
          'core:cache:internal:pexpire',
          this.nodeIdKey,
          this.heartbeatDelay * 1.5);

        await this.publisher.send('Heartbeat', { address: this.syncAddress });
      },
      this.heartbeatDelay);
  }

  /**
   * Adds a new remote node, and subscribes to it.
   * @param {string} id            - remote node ID
   * @param {string} ip            - remote node IP address
   * @param {number} lastMessageId - remote node last message ID
   * @return {boolean} false if the node was already known, true otherwise
   */
  async addNode (id, ip, lastMessageId) {
    if (this.remoteNodes.has(id)) {
      return false;
    }

    const subscriber = new ClusterSubscriber(this, id, `tcp://${ip}:${this.config.ports.sync}`);

    this.remoteNodes.set(id, subscriber);
    await subscriber.init();
    await subscriber.sync(lastMessageId);

    return true;
  }

  /**
   * Evicts a remote from the list
   * @param {string}  nodeId - remote node ID
   * @param {Object}  [options]
   * @param {boolean} [options.broadcast] - broadcast the eviction to the cluster
   * @param {string}  [options.reason] - reason of eviction
   */
  async evictNode (nodeId, { broadcast = false, reason = '' }) {
    const subscriber = this.remoteNodes.get(nodeId);

    if (!subscriber) {
      return;
    }

    this.kuzzle.log.warn(`[CLUSTER] Node "${nodeId}" evicted. Reason: ${reason}`);
    this.remoteNodes.delete(nodeId);
    this.fullState.removeNode(nodeId);
    subscriber.dispose();

    if (broadcast) {
      await this.publisher.send('NodeEvicted', {
        evictor: this.nodeId,
        nodeId,
        reason,
      });
    }
  }

  /**
   * Discovers other active nodes from the cluster and, if other nodes exist,
   * starts a handshake procedure to sync this node and to make it able to
   * handle new client requests
   *
   * @return {void}
   */
  async handshake () {
    const mutex = new Mutex(this.kuzzle, 'clusterHandshake', {
      timeout: 60000,
    });

    await mutex.lock();

    try {
      // Create this node ID until AFTER the handshake mutex is actually locked,
      // to prevent race conditions (other nodes attempting to connect to this
      // node while it's still initializing)
      await this.generateId();

      let retried = false;
      let fullState = null;
      let nodes;

      do {
        nodes = await this.listRemoteNodes();

        // No other nodes detected = no handshake required
        if (nodes.length === 0) {
          return;
        }

        // Subscribe to remote nodes and start buffering sync messages
        await Bluebird.map(nodes, ([id, ip]) => {
          const subscriber = new ClusterSubscriber(this, id, `tcp://${ip}:${this.config.ports.sync}`);
          this.remoteNodes.set(id, subscriber);
          return subscriber.init();
        });

        fullState = await this.command.getFullState(nodes);

        // Uh oh... no node was able to give us the full state.
        // We must retry later, to check if the redis keys have expired. If they
        // are still there and we still aren't able to fetch a full state, this
        // means we're probably facing a network split, and we must then shut
        // down.
        if (fullState === null) {
          if (retried) {
            this.kuzzle.log.error('[FATAL] Could not connect to discovered cluster nodes (network split detected). Shutting down.');
            this.kuzzle.shutdown();
            return;
          }

          // Disposes all subscribers
          for (const subscriber of this.remoteNodes.values()) {
            subscriber.dispose();
          }
          this.remoteNodes.clear();

          // Waits for a redis heartbeat round
          retried = true;
          const retryDelay = this.heartbeatDelay * 1.5;
          this.kuzzle.log.warn(`Unable to connect to discovered cluster nodes. Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      while (fullState === null);

      await this.fullState.loadFullState(fullState);

      const handshakeResponses = await this.command.broadcastHandshake(nodes);

      // Update subscribers: start synchronizing, or unsubscribes from nodes who
      // didn't respond
      for (const [nodeId, handshakeData] of Object.entries(handshakeResponses)) {
        const subscriber = this.remoteNodes.get(nodeId);
        if (handshakeData === null) {
          subscriber.dispose();
          this.remoteNodes.delete(nodeId);
        }
        else {
          subscriber.sync(handshakeData.lastMessageId);
          this.kuzzle.log.info(`Successfully completed the handshake with node ${nodeId}`);
        }
      }

      this.kuzzle.log.info('Successfully joined the cluster.');
    }
    finally {
      mutex.unlock();
    }
  }

  /**
   * Retrieves the list of other nodes from Redis
   * @return {Array.<Array>} key: nodeId, value: IP address
   */
  async listRemoteNodes () {
    const result = [];

    let keys = await this.kuzzle.ask(
      'core:cache:internal:searchKeys',
      `${REDIS_PREFIX}*`);

    keys = keys.filter(nodeIdKey => nodeIdKey !== this.nodeIdKey);

    if (keys.length === 0) {
      return result;
    }

    const values = await this.kuzzle.ask('core:cache:internal:mget', keys);

    for (let i = 0; i < keys.length; i++) {
      // filter keys that might have expired between the key search and their
      // values retrieval
      if (values[i] !== null) {
        result.push([keys[i].replace(REDIS_PREFIX, ''), values[i]]);
      }
    }

    return result;
  }

  /**
   * Registers ask events
   */
  registerAskEvents () {
    /**
     * Removes a room from the full state, and only for this node.
     * Removes the room from Koncorde if, and only if, no other node uses it.
     *
     * @param  {string} roomId
     * @return {void}
     */
    this.kuzzle.onAsk(
      'cluster:realtime:room:remove',
      roomId => this.removeRealtimeRoom(roomId));

    /**
     * Returns the total number of subscribers on all nodes for the provided
     * room
     *
     * @param {string} roomId
     * @returns {Number}
     */
    this.kuzzle.onAsk(
      'cluster:realtime:room:count',
      roomId => this.countRealtimeSubscribers(roomId));

    /**
     * Returns the list of existing rooms in the cluster
     *
     * @returns {Object}
     */
    this.kuzzle.onAsk(
      'cluster:realtime:room:list',
      () => this.fullState.listRealtimeRooms());

    /**
     * Returns the requested room. Used to create a room on the fly on this node
     * if it exists only on remote nodes (e.g. for the realtime:join API action)
     *
     * @param {string} roomId
     * @returns {{index: String, collection: String, normalized: Object}}
     */
    this.kuzzle.onAsk(
      'cluster:realtime:filters:get',
      roomId => this.fullState.getNormalizedFilters(roomId));
  }

  /**
   * Starts listening to events to trigger sync messages on state changes.
   *
   * @return {void}
   */
  registerEvents () {
    this.kuzzle.on(
      'core:realtime:room:create:after',
      payload => this.onNewRealtimeRoom(payload));

    this.kuzzle.on(
      'core:realtime:subscribe:after',
      roomId => this.onNewSubscription(roomId));

    this.kuzzle.on(
      'core:realtime:unsubscribe:after',
      roomId => this.onUnsubscription(roomId));

    this.kuzzle.on(
      'core:notify:document',
      ({ notification, rooms }) => {
        this.onDocumentNotification(rooms, notification);
      });

    this.kuzzle.on(
      'core:notify:user',
      ({ notification, room }) => this.onUserNotification(room, notification));

    this.kuzzle.on(
      'core:auth:strategyAdded',
      ({ name, pluginName, strategy }) => {
        this.onAuthStrategyAdded(name, pluginName, strategy);
      });

    this.kuzzle.on(
      'core:auth:strategyRemoved',
      ({ name, pluginName }) => this.onAuthStrategyRemoved(name, pluginName));

    this.kuzzle.on(
      'admin:afterDump',
      suffix => this.onDumpRequest(suffix));

    this.kuzzle.on(
      'admin:afterResetSecurity',
      () => this.onSecurityReset());

    this.kuzzle.on(
      'admin:afterShutdown',
      () => this.onShutdown());

    this.kuzzle.on(
      'collection:afterDeleteSpecifications',
      () => this.onValidatorsChanged());

    this.kuzzle.on(
      'collection:afterUpdateSpecifications',
      () => this.onValidatorsChanged());

    // Profile change events
    this.kuzzle.on(
      'core:security:profile:create',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    this.kuzzle.on(
      'core:security:profile:createOrReplace',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    this.kuzzle.on(
      'core:security:profile:update',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    this.kuzzle.on(
      'core:security:profile:delete',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    // Role change events
    this.kuzzle.on(
      'core:security:role:create',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    this.kuzzle.on(
      'core:security:role:createOrReplace',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    this.kuzzle.on(
      'core:security:role:update',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    this.kuzzle.on(
      'core:security:role:delete',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    // Index cache change events
    for (const scope of Object.values(storeScopeEnum)) {
      this.kuzzle.on(
        `core:storage:${scope}:index:create`,
        ({ args: [ index ]}) => this.onIndexCacheAdd(scope, index));

      this.kuzzle.on(
        `core:storage:${scope}:index:delete`,
        ({ args: [ index ] }) => this.onIndexCacheRemove(scope, index));

      this.kuzzle.on(
        `core:storage:${scope}:collection:create`,
        ({ args: [ index, collection ] }) => {
          this.onIndexCacheAdd(scope, index, collection);
        });

      this.kuzzle.on(
        `core:storage:${scope}:collection:delete`,
        ({ args: [ index, collection ] }) => {
          this.onIndexCacheRemove(scope, index, collection);
        });
    }
  }

  /**
   * Triggered whenever a realtime room is created on this node
   *
   * @param  {Object} payload
   * @return {void}
   */
  async onNewRealtimeRoom (payload) {
    const { collection, filters, index, roomId } = payload;
    const roomMessageId = await this.publisher.sendNewRealtimeRoom (
      roomId,
      index,
      collection,
      filters);

    this.fullState.addRealtimeRoom(roomId, index, collection, filters, {
      messageId: roomMessageId,
      nodeId: this.nodeId,
      subscribers: 0,
    });
  }

  /**
   * Triggered on a new realtime subscription
   *
   * @param  {string} roomId
   * @return {void}
   */
  async onNewSubscription (roomId) {
    const subMessageId = await this.publisher.sendSubscription(roomId);
    this.fullState.addRealtimeSubscription(roomId, this.nodeId, subMessageId);
  }

  /**
   * Triggered when a realtime room is removed from this node.
   *
   * @param  {string} roomId
   * @return {void}
   */
  async removeRealtimeRoom (roomId) {
    this.fullState.removeRealtimeRoom(roomId, this.nodeId);
    await this.publisher.sendRealtimeRoomRemoval(roomId);
  }

  /**
   * Triggered when a user unsubscribes from a room
   *
   * @param  {string} roomId
   * @return {void}
   */
  async onUnsubscription (roomId) {
    const messageId = await this.publisher.sendUnsubscription(roomId);
    this.fullState.removeRealtimeSubscription(roomId, this.nodeId, messageId);
  }

  /**
   * Triggered when a document notification must be propagated
   *
   * @param  {Array.<string>} rooms - list of rooms to notify
   * @param  {DocumentNotification} notification
   * @return {void}
   */
  async onDocumentNotification (rooms, notification) {
    await this.publisher.sendDocumentNotification(rooms, notification);
  }

  /**
   * Triggered when a user notification must be propagated
   *
   * @param  {string} room
   * @param  {UserNotification} notification
   * @return {void}
   */
  async onUserNotification (room, notification) {
    await this.publisher.sendUserNotification(room, notification);
  }

  /**
   * Triggered when a new authentication strategy has been dynamically added
   *
   * @param  {string} strategyName
   * @param  {string} pluginName
   * @param  {Object} strategyObject
   * @return {void}
   */
  async onAuthStrategyAdded (strategyName, pluginName, strategyObject) {
    await this.publisher.sendNewAuthStrategy(
      strategyName,
      pluginName,
      strategyObject);

    this.fullState.addAuthStrategy({
      pluginName,
      strategy: strategyObject,
      strategyName,
    });
  }

  /**
   * Triggered when an authentication strategy has been dynamically removed
   *
   * @param  {string} strategyName
   * @param  {string} pluginName
   * @return {void}
   */
  async onAuthStrategyRemoved (strategyName, pluginName) {
    await this.publisher.sendRemoveAuthStrategy(strategyName, pluginName);
    this.fullState.removeAuthStrategy(strategyName);
  }

  /**
   * Triggered when a dump has been requested
   *
   * @param  {string} suffix
   * @return {void}
   */
  onDumpRequest (suffix) {
    this.publisher.sendDumpRequest(suffix);
  }

  /**
   * Triggered when security rights have been reset
   *
   * @return {void}
   */
  onSecurityReset () {
    this.publisher.send('ResetSecurity', {});
  }

  /**
   * Triggered when a document validator has changed
   *
   * @return {void}
   */
  onValidatorsChanged () {
    this.publisher.send('RefreshValidators', {});
  }

  /**
   * Triggered when a profile has changed
   *
   * @param  {string} profileId
   * @return {void}
   */
  onProfileChanged (profileId) {
    this.publisher.send('InvalidateProfile', { profileId });
  }

  /**
   * Triggered when a role has changed
   *
   * @param {string} roleId
   * @return {void}
   */
  onRoleChanged (roleId) {
    this.publisher.send('InvalidateRole', { roleId });
  }

  /**
   * Triggered when an index or an index/collection pair have been added to
   * the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} [collection]
   * @return {void}
   */
  onIndexCacheAdd (scope, index, collection) {
    this.publisher.sendIndexCacheAdd(scope, index, collection);
  }

  /**
   * Triggered when an index or an index/collection pair have been removed from
   * the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} [collection]
   * @return {void}
   */
  onIndexCacheRemove (scope, index, collection) {
    this.publisher.sendIndexCacheRemove(scope, index, collection);
  }

  /**
   * Triggered when a cluster-wide shutdown has been initiated
   *
   * @return {void}
   */
  onShutdown () {
    this.publisher.send('Shutdown', {});
  }

  /**
   * Returns the total number of subscribers on the cluster for the provided
   * room
   *
   * @param {string} roomId
   * @return {void}
  */
  async countRealtimeSubscribers (roomId) {
    return this.fullState.countRealtimeSubscriptions(roomId);
  }
}

function checkConfig (config) {
  for (const prop of ['heartbeat', 'joinTimeout', 'minimumNodes']) {
    assert(
      typeof config[prop] === 'number' && config[prop] > 0,
      `[FATAL] kuzzlerc.cluster.${prop}: value must be a number greater than 0`);
  }

  for (const prop of ['command', 'sync']) {
    assert(
      typeof config.ports[prop] === 'number' && config.ports[prop] > 0,
      `[FATAL] kuzzlerc.cluster.ports.${prop}: value must be a number greater than 0`);
  }

  assert(typeof config.ipv6 === 'boolean', '[FATAL] kuzzlerc.cluster.ipv6: boolean expected');
}

module.exports = ClusterNode;
