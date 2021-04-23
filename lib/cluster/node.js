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

const getIP = require('ip');
const Bluebird = require('bluebird');
const EventEmitter = require('eventemitter3');
const _ = require('lodash');

const debug = require('../util/debug')('kuzzle:cluster:sync');
const { Mutex } = require('../util/mutex');
const { ClusterIdCardHandler } = require('./idCardHandler');
const ClusterPublisher = require('./publisher');
const ClusterSubscriber = require('./subscriber');
const ClusterState = require('./state');
const ClusterCommand = require('./command');
const kuzzleStateEnum = require('../kuzzle/kuzzleStateEnum');

/**
 * @typedef {nodeActivityEnum}
 */
const nodeActivityEnum = Object.freeze({
  ADDED: 1,
  EVICTED: 2,
});

// Handles the node logic: discovery, eviction, heartbeat, ...
// Dependencies: core:cache module must be started
class ClusterNode {
  constructor () {
    this.config = global.kuzzle.config.cluster;
    this.heartbeatDelay = this.config.heartbeat;

    this.ip = getIP.address(this.config.ip, this.config.ipv6 ? 'ipv6' : 'ipv4');

    this.nodeId = null;
    this.heartbeatTimer = null;

    this.idCardHandler = new ClusterIdCardHandler(this.ip, this.heartbeatDelay);
    this.publisher = new ClusterPublisher(this);
    this.fullState = new ClusterState();
    this.command = new ClusterCommand(this);
    this.eventEmitter = new EventEmitter();

    /**
     * Links remote node IDs with their subscriber counterpart
     * @type {Map.<string, ClusterSubscriber>}
     */
    this.remoteNodes = new Map();

    /**
     * Cluster nodes activity, used to keep track of nodes being added or
     * removed, to give more insights to cluster statuses
     */
    this.activityMaxLength = this.config.activityDepth;
    this.activity = [];
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

    global.kuzzle.onPipe('kuzzle:shutdown', () => this.shutdown());

    await this.handshake();

    this.registerEvents();
    this.registerAskEvents();

    if (this.countActiveNodes() < this.config.minimumNodes) {
      global.kuzzle.log.info('[CLUSTER] Not enough nodes active. Waiting for other nodes to join the cluster...');

      while (this.countActiveNodes() < this.config.minimumNodes) {
        await Bluebird.delay(100);
      }
    }

    return this.nodeId;
  }

  /**
   * Shutdown event: clears all timers, sends a termination status to other
   * nodes, and removes entries from the cache
   */
  async shutdown () {
    clearInterval(this.heartbeatTimer);
    await this.idCardHandler.dispose();

    for (const subscriber of this.remoteNodes.values()) {
      subscriber.dispose();
    }

    this.publisher.sendNodeShutdown(this.nodeId);

    await this.publisher.dispose();
    this.command.dispose();
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

    const subscriber = new ClusterSubscriber(this, id, ip);

    this.remoteNodes.set(id, subscriber);
    await subscriber.init();
    await subscriber.sync(lastMessageId);
    await this.idCardHandler.addNode(id);

    global.kuzzle.log.info(`[CLUSTER] Node "${id}" joined the cluster`);
    this.trackActivity(id, ip, nodeActivityEnum.ADDED);

    if ( global.kuzzle.state === kuzzleStateEnum.NOT_ENOUGH_NODES
      && this.countActiveNodes() >= this.config.minimumNodes
    ) {
      global.kuzzle.state = kuzzleStateEnum.RUNNING;
      global.kuzzle.log.warn(`[CLUSTER] Minimum number of nodes reached (${this.countActiveNodes()}). This node is now accepting requests again.`);
    }

    return true;
  }

  /**
   * Evicts this node from the cluster.
   *
   * @param  {String} reason
   * @param  {Error} [error]
   * @return {void}
   */
  async evictSelf (reason, error = null) {
    global.kuzzle.log.error(`[FATAL] ${reason}`);

    if (error) {
      global.kuzzle.log.error(error.stack);
    }

    await this.publisher.sendNodeEvicted(this.nodeId, this.nodeId, reason);

    global.kuzzle.shutdown();
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

    global.kuzzle.log.warn(`[CLUSTER] Node "${nodeId}" evicted. Reason: ${reason}`);
    this.trackActivity(
      nodeId,
      subscriber.remoteNodeIP,
      nodeActivityEnum.EVICTED,
      reason);

    await this.idCardHandler.removeNode(nodeId);
    this.remoteNodes.delete(nodeId);
    this.fullState.removeNode(nodeId);
    subscriber.dispose();

    if (broadcast) {
      await this.publisher.sendNodeEvicted(this.nodeId, nodeId, reason);
    }

    if (this.countActiveNodes() < this.config.minimumNodes) {
      global.kuzzle.state = kuzzleStateEnum.NOT_ENOUGH_NODES;
      global.kuzzle.log.warn(`[CLUSTER] Not enough nodes active (expected: ${this.config.minimumNodes}, active: ${this.countActiveNodes()}). Deactivating node until new ones are added.`);
    }

    this.enforceClusterConsistency();
  }

  /**
   * Verifies the consistency of the cluster by comparing our own known
   * topology with the one kept in other nodes ID cards
   *
   * /!\ Do not wait for this method: it's meant to run as a background check.
   * It'll never throw, and it'll never generate unhandled rejections.
   */
  async enforceClusterConsistency () {
    // Delay the check to 1 heartbeat round, to allow all nodes to update
    // their ID cards
    await Bluebird.delay(this.heartbeatDelay);

    try {
      const idCards = await this.idCardHandler.getRemoteIdCards();
      idCards.push(this.idCardHandler.idCard);

      let splits = [];

      for (const idCard of idCards) {
        let topology = Array.from(idCard.topology);
        topology.push(idCard.id);

        if (topology.length !== idCards.length) {
          topology = topology.sort();

          const found = splits.some(split => {
            if (split.length !== topology.length) {
              return false;
            }

            return split.every((id, index) => id === topology[index]);
          });

          if (!found) {
            splits.push(topology);
          }
        }
      }

      // No split detected, the cluster is consistent
      if (splits.length === 0) {
        return;
      }

      // There is at least 1 cluster split detected.
      //
      // First we elect the smallest split possible.
      // If multiple splits are eligibles, we choose amongst them the split
      // containing the youngest isolated node (isolated = the node is in this
      // split alone, and in no other splits). If no split is eligible using
      // this method, we fall back to the smallest split containing the youngest
      // node (isolated or not).
      //
      // The goal of this process is to force at least 1 node to kill itself,
      // with all nodes concluding on their own on the same list of nodes to
      // shut down.
      splits = splits.sort((a, b) => a.length - b.length);
      const eligibleSplits = splits
        .filter(split => split.length === splits[0].length);

      let candidates;

      if (eligibleSplits.length === 1) {
        candidates = eligibleSplits[0];
      }
      else {
        // Beware: search isolated nodes in ALL the splits, not only the
        // smallest ones
        let isolatedNodes = _.xor(...splits);
        const eligibleNodes = _.uniq(_.flatten(eligibleSplits));

        isolatedNodes = _.intersection(isolatedNodes, eligibleNodes);

        const isIsolated = isolatedNodes.length > 0;

        // safety measure: this should never happen
        if (isolatedNodes.length === 0) {
          isolatedNodes = eligibleNodes;
        }

        let youngestNode;

        for (let i = 0; i < isolatedNodes.length; i++) {
          const idCard = idCards.find(card => card.id === isolatedNodes[i]);
          if (!youngestNode || idCard.birthdate > youngestNode.birthdate) {
            youngestNode = idCard;
          }
        }

        if (isIsolated) {
          for (let i = 0; !candidates && i < eligibleSplits.length; i++) {
            if (eligibleSplits[i].includes(youngestNode.id)) {
              candidates = _.intersection(eligibleSplits[i], isolatedNodes);
            }
          }
        }
        else {
          candidates = [youngestNode.id];
        }
      }

      if (candidates.includes(this.nodeId)) {
        global.kuzzle.log.error('[CLUSTER] Network split detected. This node is outside the cluster: shutting down.');
        global.kuzzle.shutdown();
        return;
      }

      // Rerun the cluster consistency check
      await this.enforceClusterConsistency();
    }
    catch (err) {
      global.kuzzle.log.error('[CLUSTER] Unexpected exception caught during a cluster consistency check. Shutting down...');
      global.kuzzle.log.error(err.stack);
      global.kuzzle.shutdown();
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
    const handshakeTimeout = setTimeout(
      () => {
        global.kuzzle.log.error(`[FATAL] Failed to join the cluster: timed out (joinTimeout: ${this.config.joinTimeout}ms)`);
        global.kuzzle.shutdown();
      },
      this.config.joinTimeout);

    const mutex = new Mutex('clusterHandshake', {
      timeout: this.config.joinTimeout,
    });

    await mutex.lock();

    try {
      // Create the ID Key AFTER the handshake mutex is actually locked,
      // to prevent race conditions (other nodes attempting to connect to this
      // node while it's still initializing)
      await this.idCardHandler.createIdCard();

      this.nodeId = this.idCardHandler.nodeId;

      await this.startHeartbeat();

      let retried = false;
      let fullState = null;
      let nodes;

      do {
        nodes = await this.idCardHandler.getRemoteIdCards();

        // No other nodes detected = no handshake required
        if (nodes.length === 0) {
          this.trackActivity(this.nodeId, this.ip, nodeActivityEnum.ADDED);
          return;
        }

        // Subscribe to remote nodes and start buffering sync messages
        await Bluebird.map(nodes, ({ id, ip }) => {
          const subscriber = new ClusterSubscriber(this, id, ip);
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
            global.kuzzle.log.error('[FATAL] Could not connect to discovered cluster nodes (network split detected). Shutting down.');
            global.kuzzle.shutdown();
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
          global.kuzzle.log.warn(`Unable to connect to discovered cluster nodes. Retrying in ${retryDelay}ms...`);
          await Bluebird.delay(retryDelay);
        }
      }
      while (fullState === null);

      await this.fullState.loadFullState(fullState);
      this.activity = fullState.activity
        ? fullState.activity
        : this.activity;

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
          global.kuzzle.log.info(`Successfully completed the handshake with node ${nodeId}`);
        }
      }

      global.kuzzle.log.info('Successfully joined the cluster.');
      this.trackActivity(this.nodeId, this.ip, nodeActivityEnum.ADDED);
    }
    finally {
      clearTimeout(handshakeTimeout);
      mutex.unlock();
    }
  }

  countActiveNodes () {
    return this.remoteNodes.size + 1;
  }

  startHeartbeat () {
    this.heartbeatTimer = setInterval(() => {
      this.publisher.sendHeartbeat(this.syncAddress);
    }, this.heartbeatDelay);
  }

  /**
   * Cluster activity tracking
   *
   * @param {string} id
   * @param {string} ip
   * @param {nodeActivityEnum} event
   * @param {string} [reason]
   */
  trackActivity (id, ip, event, reason) {
    if (this.activity.length > this.activityMaxLength) {
      this.activity.shift();
    }

    this.activity.push({
      address: ip,
      date: (new Date()).toISOString(),
      event,
      id,
      reason,
    });
  }

  /**
   * Returns the full status of the cluster
   * @return {Object}
   */
  async getStatus () {
    const status = {
      activeNodes: 0,
      activity: this.activity.map(({address, date, event, id, reason}) => ({
        address,
        date,
        event: event === nodeActivityEnum.ADDED ? 'joined' : 'evicted',
        id,
        reason,
      })),
      nodes: [],
    };
    const idCards = await this.idCardHandler.getRemoteIdCards();
    idCards.push(this.idCardHandler.idCard);

    for (const idCard of idCards) {
      status.nodes.push({
        address: idCard.ip,
        birthdate: new Date(idCard.birthdate).toISOString(),
        id: idCard.id,
      });
    }

    status.activeNodes = status.nodes.length;

    return status;
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
    global.kuzzle.onAsk(
      'cluster:realtime:room:remove',
      roomId => this.removeRealtimeRoom(roomId));

    /**
     * Returns the total number of subscribers on all nodes for the provided
     * room
     *
     * @param {string} roomId
     * @returns {Number}
     */
    global.kuzzle.onAsk(
      'cluster:realtime:room:count',
      roomId => this.countRealtimeSubscribers(roomId));

    /**
     * Returns the list of existing rooms in the cluster
     *
     * @returns {Object}
     */
    global.kuzzle.onAsk(
      'cluster:realtime:room:list',
      () => this.fullState.listRealtimeRooms());

    /**
     * Returns the requested room. Used to create a room on the fly on this node
     * if it exists only on remote nodes (e.g. for the realtime:join API action)
     *
     * @param {string} roomId
     * @returns {{index: String, collection: String, normalized: Object}}
     */
    global.kuzzle.onAsk(
      'cluster:realtime:filters:get',
      roomId => this.fullState.getNormalizedFilters(roomId));

    /**
     * Broadcasts an event to other nodes
     *
     * @param {string} event name
     * @param {Object} payload - event payload
     */
    global.kuzzle.onAsk(
      'cluster:event:broadcast',
      (event, payload) => this.broadcast(event, payload));

    /**
     * Listens to a cluster-wide event
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk(
      'cluster:event:on',
      (event, fn) => this.eventEmitter.on(event, fn));

    /**
     * Listens to a cluster-wide event once.
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk(
      'cluster:event:once',
      (event, fn) => this.eventEmitter.once(event, fn));

    /**
     * Removes a listener from an event
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk(
      'cluster:event:off',
      (event, fn) => this.eventEmitter.removeListener(event, fn));

    /**
     * Removes all listeners from an event
     *
     * @param {string} event name
     */
    global.kuzzle.onAsk(
      'cluster:event:removeAllListeners',
      event => this.eventEmitter.removeAllListeners(event));

    /**
     * Returns the full status of the cluster
     */
    global.kuzzle.onAsk('cluster:status:get', () => this.getStatus());
  }

  /**
   * Starts listening to events to trigger sync messages on state changes.
   *
   * @return {void}
   */
  registerEvents () {
    global.kuzzle.on(
      'core:realtime:room:create:after',
      payload => this.onNewRealtimeRoom(payload));

    global.kuzzle.on(
      'core:realtime:subscribe:after',
      roomId => this.onNewSubscription(roomId));

    global.kuzzle.on(
      'core:realtime:unsubscribe:after',
      roomId => this.onUnsubscription(roomId));

    global.kuzzle.on(
      'core:notify:document',
      ({ notification, rooms }) => {
        this.onDocumentNotification(rooms, notification);
      });

    global.kuzzle.on(
      'core:notify:user',
      ({ notification, room }) => this.onUserNotification(room, notification));

    global.kuzzle.on(
      'core:auth:strategyAdded',
      ({ name, pluginName, strategy }) => {
        this.onAuthStrategyAdded(name, pluginName, strategy);
      });

    global.kuzzle.on(
      'core:auth:strategyRemoved',
      ({ name, pluginName }) => this.onAuthStrategyRemoved(name, pluginName));

    global.kuzzle.on(
      'admin:afterDump',
      suffix => this.onDumpRequest(suffix));

    global.kuzzle.on(
      'admin:afterResetSecurity',
      () => this.onSecurityReset());

    global.kuzzle.on(
      'admin:afterShutdown',
      () => this.onShutdown());

    global.kuzzle.on(
      'collection:afterDeleteSpecifications',
      () => this.onValidatorsChanged());

    global.kuzzle.on(
      'collection:afterUpdateSpecifications',
      () => this.onValidatorsChanged());

    // Profile change events
    global.kuzzle.on(
      'core:security:profile:create',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    global.kuzzle.on(
      'core:security:profile:createOrReplace',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    global.kuzzle.on(
      'core:security:profile:update',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    global.kuzzle.on(
      'core:security:profile:delete',
      ({ args: [ profileId ] }) => this.onProfileChanged(profileId));

    // Role change events
    global.kuzzle.on(
      'core:security:role:create',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    global.kuzzle.on(
      'core:security:role:createOrReplace',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    global.kuzzle.on(
      'core:security:role:update',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    global.kuzzle.on(
      'core:security:role:delete',
      ({ args: [ roleId ] }) => this.onRoleChanged(roleId));

    // Index cache change events
    global.kuzzle.on(
      'core:storage:index:create:after',
      ({ index, scope }) => this.onIndexAdded(scope, index));

    global.kuzzle.on(
      'core:storage:index:delete:after',
      ({ index, scope }) => this.onIndexesRemoved(scope, [ index ]));

    global.kuzzle.on(
      'core:storage:index:mDelete:after',
      ({ indexes, scope }) => this.onIndexesRemoved(scope, indexes));

    global.kuzzle.on(
      'core:storage:collection:create:after',
      ({ collection, index, scope }) => {
        this.onCollectionAdded(scope, index, collection);
      });

    global.kuzzle.on(
      'core:storage:collection:delete:after',
      ({ collection, index, scope }) => {
        this.onCollectionRemoved(scope, index, collection);
      });
  }

  /**
   * Triggered whenever a realtime room is created on this node
   *
   * @param  {Object} payload
   * @return {void}
   */
  onNewRealtimeRoom (payload) {
    const { collection, filters, index, roomId } = payload;
    const roomMessageId = this.publisher.sendNewRealtimeRoom(
      roomId,
      index,
      collection,
      filters);

    debug(
      '[%s] Broadcasting new realtime room %s (message: %d)',
      this.nodeId,
      roomId,
      roomMessageId);

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
  onNewSubscription (roomId) {
    const subMessageId = this.publisher.sendSubscription(roomId);

    debug(
      '[%s] Broadcasting new realtime subscription on room %s (message: %d)',
      this.nodeId,
      roomId,
      subMessageId);

    this.fullState.addRealtimeSubscription(roomId, this.nodeId, subMessageId);
  }

  /**
   * Triggered when a realtime room is removed from this node.
   *
   * @param  {string} roomId
   * @return {void}
   */
  async removeRealtimeRoom (roomId) {
    const messageId = await this.publisher.sendRemoveRealtimeRoom(roomId);

    debug(
      '[%s] Broadcasted the removal of room %s (message: %d)',
      this.nodeId,
      roomId,
      messageId);

    this.fullState.removeRealtimeRoom(roomId, this.nodeId);
  }

  /**
   * Broadcasts an event to other nodes
   *
   * @param {string} event name
   * @param {Object} payload - event payload
   */
  broadcast (event, payload) {
    const messageId = this.publisher.sendClusterWideEvent(event, payload);

    debug(
      '[%s] Emitted cluster-wide event "%s" (message: %d)',
      this.nodeId,
      event,
      messageId);
  }

  /**
   * Triggered when a user unsubscribes from a room
   *
   * @param  {string} roomId
   * @return {void}
   */
  onUnsubscription (roomId) {
    const messageId = this.publisher.sendUnsubscription(roomId);

    debug(
      '[%s] Broadcasting realtime unsubscription on room %s (message: %d)',
      this.nodeId,
      roomId,
      messageId);

    this.fullState.removeRealtimeSubscription(roomId, this.nodeId, messageId);
  }

  /**
   * Triggered when a document notification must be propagated
   *
   * @param  {Array.<string>} rooms - list of rooms to notify
   * @param  {DocumentNotification} notification
   * @return {void}
   */
  onDocumentNotification (rooms, notification) {
    this.publisher.sendDocumentNotification(rooms, notification);
  }

  /**
   * Triggered when a user notification must be propagated
   *
   * @param  {string} room
   * @param  {UserNotification} notification
   * @return {void}
   */
  onUserNotification (room, notification) {
    this.publisher.sendUserNotification(room, notification);
  }

  /**
   * Triggered when a new authentication strategy has been dynamically added
   *
   * @param  {string} strategyName
   * @param  {string} pluginName
   * @param  {Object} strategyObject
   * @return {void}
   */
  onAuthStrategyAdded (strategyName, pluginName, strategyObject) {
    this.publisher.sendNewAuthStrategy(
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
  onAuthStrategyRemoved (strategyName, pluginName) {
    this.publisher.sendRemoveAuthStrategy(strategyName, pluginName);

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
   * Triggered when an index has been added to the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @return {void}
   */
  onIndexAdded (scope, index) {
    this.publisher.sendAddIndex(scope, index);
  }

  /**
   * Triggered when a collection has been added to the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @return {void}
   */
  onCollectionAdded (scope, index, collection) {
    this.publisher.sendAddCollection(scope, index, collection);
  }

  /**
   * Triggered when index have been removed from the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {Array.<string>} indexes
   * @return {void}
   */
  onIndexesRemoved (scope, indexes) {
    this.publisher.sendRemoveIndexes(scope, indexes);
  }

  /**
   * Triggered when a collection has been removed from the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @return {void}
   */
  onCollectionRemoved (scope, index, collection) {
    this.publisher.sendRemoveCollection(scope, index, collection);
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

module.exports = ClusterNode;
