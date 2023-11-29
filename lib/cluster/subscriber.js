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

const { Subscriber } = require("zeromq");
const protobuf = require("protobufjs");
const Long = require("long");

const debug = require("../util/debug")("kuzzle:cluster:sync");
const DocumentNotification = require("../core/realtime/notification/document");
const UserNotification = require("../core/realtime/notification/user");
const { has } = require("../util/safeObject");
const { fromKoncordeIndex } = require("../util/koncordeCompat");

/* eslint-disable sort-keys */
const stateEnum = Object.freeze({
  BUFFERING: 1,
  SANE: 2,
  MISSING_HEARTBEAT: 3,
  EVICTED: 4,
});
/* eslint-enable sort-keys */

// Handles messages received from other nodes
class ClusterSubscriber {
  /**
   * @constructor
   * @param {ClusterNode} localNode
   * @param {string} remoteNodeId - Remote node unique ID
   * @param {string} remoteNodeIP - address of the distant node
   */
  constructor(localNode, remoteNodeId, remoteNodeIP) {
    // not to be confused with remote nodes
    this.localNode = localNode;

    this.remoteNodeIP = remoteNodeIP;
    this.remoteNodeAddress = `tcp://${remoteNodeIP}:${this.localNode.config.ports.sync}`;
    this.remoteNodeId = remoteNodeId;
    // Used in debug mode when the node might be slower
    this.remoteNodeEvictionPrevented = false;
    this.socket = null;
    this.protoroot = null;

    // keeps track of received message ids from the remote node
    this.lastMessageId = new Long(0, 0, true);

    // A subscriber starts in the BUFFERING state, meaning it stores incoming
    // sync messages without processing them, until it enters the SANE state
    // This delays applying sync messages while the local node initializes
    this.state = stateEnum.BUFFERING;
    this.buffer = [];

    // keeps track of the remote node heartbeats, and evicts it if no
    // heartbeats have been received after some time
    this.heartbeatTimer = null;
    this.lastHeartbeat = Date.now();
    this.heartbeatDelay = this.localNode.heartbeatDelay * 1.5;

    // Messages handlers (quick translation between a topic name and its
    // associated handler)
    this.handlers = Object.freeze({
      AddCollection: this.handleCollectionAddition,
      AddIndex: this.handleIndexAddition,
      ClusterWideEvent: this.handleClusterWideEvent,
      DocumentNotification: this.handleDocumentNotification,
      DumpRequest: this.handleDumpRequest,
      Heartbeat: this.handleHeartbeat,
      InvalidateProfile: this.handleProfileInvalidation,
      InvalidateRole: this.handleRoleInvalidation,
      NewAuthStrategy: this.handleNewAuthStrategy,
      NewRealtimeRoom: this.handleNewRealtimeRoom,
      NodeEvicted: this.handleNodeEviction,
      NodePreventEviction: this.handleNodePreventEviction,
      NodeShutdown: this.handleNodeShutdown,
      RefreshIndexCache: this.handleRefreshIndexCache,
      RefreshValidators: this.handleRefreshValidators,
      RemoveAuthStrategy: this.handleAuthStrategyRemoval,
      RemoveCollection: this.handleCollectionRemoval,
      RemoveIndexes: this.handleIndexesRemoval,
      RemoveRealtimeRoom: this.handleRealtimeRoomRemoval,
      ResetSecurity: this.handleResetSecurity,
      Shutdown: this.handleShutdown,
      Subscription: this.handleSubscription,
      Unsubscription: this.handleUnsubscription,
      UserNotification: this.handleUserNotification,
    });
  }

  /**
   * Initializes this class, establishes a connection to the remote node and
   * starts listening to it.
   */
  async init() {
    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
    this.socket = new Subscriber();
    this.socket.connect(this.remoteNodeAddress);
    this.socket.subscribe();
    this.heartbeatTimer = setInterval(
      () => this.checkHeartbeat(),
      this.heartbeatDelay,
    );

    this.listen();
  }

  /**
   * Starts subscribing to other nodes
   * Do NOT wait this method: it's an infinite loop, it's not meant to ever
   * return (unless the remote node has been evicted)
   */
  async listen() {
    while (this.state !== stateEnum.EVICTED) {
      let topic;
      let data;

      try {
        [topic, data] = await this.socket.receive();
      } catch (e) {
        if (this.state !== stateEnum.EVICTED) {
          await this.evictNode({
            broadcast: true,
            reason: e.message,
          });
        }

        return;
      }

      // do nothing is the node was evicted even if we already check
      // for this in processData()
      if (this.state === stateEnum.EVICTED) {
        return;
      }

      if (this.state !== stateEnum.BUFFERING) {
        await this.processData(topic.toString(), data);
      } else {
        this.buffer.push([topic.toString(), data]);
      }
    }
  }

  /**
   * Plays all buffered sync messages, and switches this subscriber state from
   * BUFFERING to SANE.
   *
   * @param  {Long} lastMessageId
   * @return {void}
   */
  async sync(lastMessageId) {
    this.lastMessageId = lastMessageId;

    // copy the buffer for processing: new sync messages might be buffered
    // while we apply older messages with async functions
    while (this.buffer.length > 0) {
      const _buffer = this.buffer;
      this.buffer = [];

      for (let i = 0; i < _buffer.length; i++) {
        await this.processData(_buffer[i][0], _buffer[i][1]);
      }
    }

    this.state = stateEnum.SANE;
  }

  /**
   * Decodes an incoming message, and dispatches it.
   * The topic name must match a protobuf message.
   *
   * /!\ This method MUST NEVER THROW
   * It's awaited by this.listen(), which cannot be awaited (infinite loop),
   * and it also cannot afford to attach a rejection handler everytime a message
   * is received to prevent clogging the event loop with unnecessary promises
   *
   * @param  {string} topic
   * @param  {Buffer} data
   * @return {void}
   */
  async processData(topic, data) {
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const decoder = this.protoroot.lookup(topic);

    if (decoder === null) {
      await this.evictNode({
        broadcast: true,
        reason: `received an invalid message from ${this.remoteNodeId} (unknown topic "${topic}")`,
      });
      return;
    }

    const message = decoder.toObject(decoder.decode(data));

    if (!(await this.validateMessage(message))) {
      return;
    }

    try {
      // If we are receiving messages from a node,
      // it means the node is alive so it should counts as an heartbeat
      this.handleHeartbeat();
      await this.handlers[topic].call(this, message);
    } catch (e) {
      this.localNode.evictSelf(
        `Unable to process sync message (topic: ${topic}, message: ${JSON.stringify(
          message,
        )}`,
        e,
      );
    }
  }

  async handleNodePreventEviction(message) {
    this.remoteNodeEvictionPrevented = message.evictionPrevented;
  }

  /**
   * Handles a heartbeat from the remote node
   *
   * @return {void}
   */
  handleHeartbeat() {
    this.lastHeartbeat = Date.now();
  }

  /**
   * Handles a node eviction message.
   *
   * @param  {Object} message - decoded NodeEvicted protobuf message
   * @return {void}
   */
  async handleNodeEviction(message) {
    if (message.nodeId === this.localNode.nodeId) {
      global.kuzzle.log.error(
        `[CLUSTER] Node evicted by ${message.evictor}. Reason: ${message.reason}`,
      );
      global.kuzzle.shutdown();
      return;
    }

    await this.localNode.evictNode(message.nodeId, {
      broadcast: false,
      reason: message.reason,
    });
  }

  /**
   * Handles a node shutdown.
   *
   * @param  {Object} message - decoded NodeShutdown protobuf message
   * @return {void}
   */
  async handleNodeShutdown(message) {
    await this.localNode.evictNode(message.nodeId, {
      broadcast: false,
      reason: "Node is shutting down",
    });
  }

  /**
   * Handles messages about realtime room creations
   *
   * @param  {Object} message - decoded NewRealtimeRoom protobuf message
   * @return {void}
   */
  handleNewRealtimeRoom(message) {
    const { id, index, filter, messageId } = message;
    const icpair = fromKoncordeIndex(index);

    debug(
      "New realtime room created by node %s (message: %d, room: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      messageId,
      id,
      icpair.index,
      icpair.collection,
    );

    this.localNode.fullState.addRealtimeRoom(
      id,
      icpair.index,
      icpair.collection,
      JSON.parse(filter),
      {
        messageId,
        nodeId: this.remoteNodeId,
        subscribers: 0,
      },
    );
  }

  /**
   * Handles messages about realtime subscriptions
   *
   * @param  {Object} message - decoded Subscription protobuf message
   * @return {void}
   */
  handleSubscription(message) {
    debug(
      "New realtime subscription received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.addRealtimeSubscription(
      message.roomId,
      this.remoteNodeId,
      message.messageId,
    );
  }

  /**
   * Handles messages about realtime room removal
   *
   * @param  {Object} message - decoded RemoveRealtimeRoom protobuf message
   * @return {void}
   */
  handleRealtimeRoomRemoval(message) {
    debug(
      "Realtime room removal received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.removeRealtimeRoom(
      message.roomId,
      this.remoteNodeId,
    );
  }

  /**
   * Handles messages about user unsubscriptions
   *
   * @param  {Object} message - decoded Unscription protobuf message
   * @return {void}
   */
  handleUnsubscription(message) {
    debug(
      "Realtime unsubscription received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.removeRealtimeSubscription(
      message.roomId,
      this.remoteNodeId,
      message.messageId,
    );
  }

  /**
   * Handles messages about cluster-wide events
   *
   * @param {Object} message - decoded ClusterWideEvent protobuf message
   * @return {void}
   */
  handleClusterWideEvent(message) {
    const payload = JSON.parse(message.payload);

    this.localNode.eventEmitter.emit(message.event, payload);
  }

  /**
   * Handles messages about document notifications
   *
   * @param {Object} message - decoded DocumentNotification protobuf message
   * @return {void}
   */
  async handleDocumentNotification(message) {
    const notification = new DocumentNotification({
      action: message.action,
      collection: message.collection,
      controller: message.controller,
      index: message.index,
      node: this.remoteNodeId,
      protocol: message.protocol,
      requestId: message.requestId,
      result: JSON.parse(message.result),
      scope: message.scope,
      status: message.status,
      timestamp: message.timestamp.toNumber(),
      volatile: JSON.parse(message.volatile),
    });

    return global.kuzzle.ask(
      "core:realtime:document:dispatch",
      message.rooms,
      notification,
    );
  }

  /**
   * Handles messages about user notifications
   *
   * @param {Object} message - decoded UserNotification protobuf message
   * @return {void}
   */
  async handleUserNotification(message) {
    const notification = new UserNotification({
      action: message.action,
      collection: message.collection,
      controller: message.controller,
      index: message.index,
      node: this.remoteNodeId,
      protocol: message.protocol,
      result: JSON.parse(message.result),
      status: message.status,
      timestamp: message.timestamp.toNumber(),
      user: message.user,
      volatile: JSON.parse(message.volatile),
    });

    return global.kuzzle.ask(
      "core:realtime:user:sendMessage",
      message.room,
      notification,
    );
  }

  /**
   * Handles messages about new authentication strategies
   *
   * @param  {Object} message - decoded NewAuthStrategy protobuf message
   * @return {void}
   */
  handleNewAuthStrategy(message) {
    const { pluginName, strategy, strategyName } = message;

    debug(
      "New authentication strategy added by node %s (plugin: %s, strategy: %s)",
      this.remoteNodeId,
      pluginName,
      strategyName,
    );

    this.localNode.fullState.addAuthStrategy(message);

    global.kuzzle.pluginsManager.registerStrategy(
      pluginName,
      strategyName,
      strategy,
    );
  }

  /**
   * Handles messages about authentication strategy removals
   *
   * @param  {Object} message - decoded RemoveAuthStrategy protobuf message
   * @return {void}
   */
  handleAuthStrategyRemoval(message) {
    const { pluginName, strategyName } = message;

    debug(
      "Authentication strategy removed by node %s (plugin: %s, strategy: %s)",
      this.remoteNodeId,
      pluginName,
      strategyName,
    );

    global.kuzzle.pluginsManager.unregisterStrategy(pluginName, strategyName);
    this.localNode.fullState.removeAuthStrategy(strategyName);
  }

  /**
   * Handles messages about security resets
   *
   * @return {void}
   */
  async handleResetSecurity() {
    debug("Security reset received from node %s", this.remoteNodeId);
    await global.kuzzle.ask("core:security:profile:invalidate");
    await global.kuzzle.ask("core:security:role:invalidate");
  }

  /**
   * Handles a cross-nodes dump request
   *
   * @param {Object} message - decoded DumpRequest protobuf message
   * @return {void}
   */
  handleDumpRequest(message) {
    debug("Dump generation request received from node %s", this.remoteNodeId);
    global.kuzzle.dump(message.suffix);
  }

  /**
   * Handles cluster-wide shutdown
   * @return {void}
   */
  handleShutdown() {
    debug(
      "Cluster-wide shutdown request received from node %s",
      this.remoteNodeId,
    );
    global.kuzzle.log.error(
      `[CLUSTER] Cluster wide shutdown from ${this.remoteNodeId}`,
    );
    global.kuzzle.shutdown();
  }

  /**
   * Handles changes on document validators
   *
   * @return {void}
   */
  async handleRefreshValidators() {
    debug(
      "Validators changed notification received from node %s",
      this.remoteNodeId,
    );
    await global.kuzzle.validation.curateSpecification();
  }

  /**
   * Handles manual refresh of the index cache
   */
  async handleRefreshIndexCache() {
    debug(
      "Index cache manually refresh received from node %s",
      this.remoteNodeId,
    );
    await global.kuzzle.ask("core:storage:public:cache:refresh", {
      from: "cluster",
    });
  }

  /**
   * Invalidates a profile to force reloading it from the storage space
   *
   * @param {Object} message - decoded DumpRequest protobuf message
   * @return {void}
   */
  async handleProfileInvalidation(message) {
    debug(
      "Profile invalidation request received from node %s (profile: %s)",
      this.remoteNodeId,
      message.profileId,
    );

    await global.kuzzle.ask(
      "core:security:profile:invalidate",
      message.profileId,
    );
  }

  /**
   * Invalidates a role to force reloading it from the storage space
   *
   * @param {Object} message - decoded DumpRequest protobuf message
   * @return {void}
   */
  async handleRoleInvalidation(message) {
    debug(
      "Role invalidation request received from node %s (role: %s)",
      this.remoteNodeId,
      message.roleId,
    );

    await global.kuzzle.ask("core:security:role:invalidate", message.roleId);
  }

  /**
   * Adds a new index to the index cache
   *
   * @param {Object} message - decoded IndexCacheAdd protobuf message
   * @return {void}
   */
  async handleIndexAddition(message) {
    const { index, scope } = message;

    debug(
      "New index added by node %s (scope: %s, index: %s)",
      this.remoteNodeId,
      scope,
      index,
    );

    await global.kuzzle.ask(`core:storage:${scope}:cache:addIndex`, index);
  }

  /**
   * Removes indexes from the index cache
   *
   * @param {Object} message - decoded IndexCacheAdd protobuf message
   * @return {void}
   */
  async handleIndexesRemoval(message) {
    const { indexes, scope } = message;

    debug(
      "Indexes removed by node %s (scope: %s, indexes: %s)",
      this.remoteNodeId,
      scope,
      indexes,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:removeIndexes`,
      indexes,
    );
  }

  /**
   * Adds a new collection to the index cache
   *
   * @param {Object} message - decoded IndexCacheAdd protobuf message
   * @return {void}
   */
  async handleCollectionAddition(message) {
    const { collection, index, scope } = message;

    debug(
      "New collection added by node %s (scope: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      scope,
      index,
      collection,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:addCollection`,
      index,
      collection,
    );
  }

  /**
   * Removes a collection from the index cache
   *
   * @param {Object} message - decoded IndexCacheAdd protobuf message
   * @return {void}
   */
  async handleCollectionRemoval(message) {
    const { collection, index, scope } = message;

    debug(
      "Indexes removed by node %s (scope: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      scope,
      index,
      collection,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:removeCollection`,
      index,
      collection,
    );
  }

  /**
   * Checks that we did receive a heartbeat from the remote node
   * If a heartbeat is missing, we allow 1 heartbeat round for the remote node
   * to recover, otherwise we evict it from the cluster.
   */
  async checkHeartbeat() {
    if (this.remoteNodeEvictionPrevented) {
      // Fake the heartbeat while the node eviction prevention is enabled
      // otherwise when the node eviction prevention is disabled
      // the node will be evicted if it did not send a heartbeat before disabling the protection.
      this.lastHeartbeat = Date.now();
      return;
    }

    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const now = Date.now();

    if (now - this.lastHeartbeat > this.heartbeatDelay) {
      if (this.state === stateEnum.MISSING_HEARTBEAT) {
        await this.evictNode({
          broadcast: true,
          reason: "heartbeat timeout",
        });
      } else {
        this.state = stateEnum.MISSING_HEARTBEAT;
      }
    } else {
      this.state = stateEnum.SANE;
    }
  }

  /**
   * Disconnects from the remote node, and frees all allocated resources.
   */
  dispose() {
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    this.state = stateEnum.EVICTED;
    this.socket.close();
    this.socket = null;
    clearInterval(this.heartbeatTimer);
  }

  /**
   * Checks that the received message is the one we expect.
   * @param  {Object} message - decoded protobuf message
   * @return {boolean} false: the message must be discarded, true otherwise
   */
  async validateMessage(message) {
    if (!has(message, "messageId")) {
      global.kuzzle.log.warn(
        `Invalid message received from node ${this.remoteNodeId}. Evicting it.`,
      );

      await this.evictNode({
        broadcast: true,
        reason: 'invalid message received (missing "messageId" field)',
      });

      return false;
    }

    if (
      this.state === stateEnum.BUFFERING &&
      this.lastMessageId.greaterThanOrEqual(message.messageId)
    ) {
      return false;
    }

    this.lastMessageId = this.lastMessageId.add(1);

    if (this.lastMessageId.notEquals(message.messageId)) {
      await this.localNode.evictSelf(
        `Node out-of-sync: ${
          message.messageId - this.lastMessageId - 1
        } messages lost from node ${this.remoteNodeId}`,
      );
      return false;
    }

    return true;
  }

  async evictNode({ broadcast, reason }) {
    this.state = stateEnum.EVICTED;

    await this.localNode.evictNode(this.remoteNodeId, { broadcast, reason });
  }
}

ClusterSubscriber.stateEnum = stateEnum;

module.exports = ClusterSubscriber;
