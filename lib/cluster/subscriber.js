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

const { Subscriber } = require('zeromq');
const protobuf = require('protobufjs');

const { has } = require('../util/safeObject');

// Handles messages received from other nodes
// /!\ Enum values are used as bit masks to represent multiple possible
// problems in the same state value
const stateEnum = Object.freeze({
  EVICTED: 1,
  MESSAGES_LOST: 2,
  MISSING_HEARTBEAT: 4,
});

class ClusterSubscriber {
  /**
   * @constructor
   * @param {ClusterNode} localNode
   * @param {string} remoteNodeId - Remote node unique ID
   * @param {string} remoteNodeAddress - address of the distant node
   */
  constructor (localNode, remoteNodeId, remoteNodeAddress, lastMessageId) {
    this.kuzzle = localNode.kuzzle;

    // not to be confused with distant nodes
    this.localNode = localNode;

    this.remoteNodeAddress = remoteNodeAddress;
    this.remoteNodeId = remoteNodeId;
    this.socket = null;
    this.protoroot = null;

    // State, used with bit masks
    this.state = 0;

    // keeps track of received message ids from the remote node
    this.lastMessageId = lastMessageId;

    // keeps track of the remote node heartbeats, and removes it if no
    // heartbeats have been received after some time
    this.heartbeatDelay = localNode.config.heartbeat;
    this.heartbeatTimer = null;
    this.lastHeartbeat = null;
  }

  /**
   * Starts subscribing to other nodes
   * @return {[type]} [description]
   */
  async listen () {
    this.protoroot = await protobuf.load('./protobuf/sync.proto');
    this.socket = new Subscriber();
    this.socket.connect(this.remoteNodeAddress);
    this.heartbeatTimer = setInterval(
      () => this.checkHeartbeat(),
      this.localNode.heartbeatDelay);

    while (!(this.state & stateEnum.EVICTED)) {
      let topic;
      let data;

      try {
        [topic, data] = await this.socket;
      }
      catch (e) {
        this.localNode.evictNode(this.remoteNodeId, {
          broadcast: true,
          reason: e.message,
        });
      }

      this.processData(topic, data);
    }
  }

  /**
   * Decodes an incoming message, and dispatches it.
   * The topic name must match a protobuf message.
   * This method is not meant to be awaited: it must never throw
   *
   * @param  {string} topic
   * @param  {Buffer} data
   */
  async processData (topic, data) {
    const type = this.protoroot.lookup(topic);

    if (type === null) {
      await this.localNode.evictNode(this.remoteNodeId, {
        broadcast: true,
        reason: `Received an invalid message from ${this.remoteNodeId} (unknown topic "${topic}")`,
      });
      return;
    }

    const message = type.decode(data).toJSON();

    this.checkMessageId(message);

    try {
      switch (topic) {
        case 'Heartbeat':
          this.handleHeartbeat(message);
          break;
        case 'NodeEvicted':
          this.handleNodeEviction(message);
          break;
      }
    }
    catch (e) {
      this.kuzzle.log.error(`[FATAL] Unable to process sync message (topic: ${topic}, message: ${JSON.stringify(message)}`);
      this.kuzzle.shutdown();
    }
  }

  /**
   * Handles a heartbeat from the remote node
   * @param  {Object} message
   */
  handleHeartbeat (message) {
    // We allow 1 heartbeat round reporting missing messages to recover
    // (e.g. to prevent false positives due to race conditions)
    // Otherwise, we need to shut down this node, as it lost messages and it
    // cannot recover: if we try a replay strategy and if the message was lost
    // due to network congestion, then we'll only make matters worse...
    // Respawning a new node is probably the best course of action in that case.
    if (message.lastMessageId !== this.lastMessageId) {
      if (this.state & stateEnum.MESSAGES_LOST) {
        this.kuzzle.log.error(`[FATAL] Node out-of-sync: lost ${this.lastMessageId - message.lastMessageId} messages from node ${this.remoteNodeId}`);
        this.kuzzle.shutdown();
        return;
      }

      this.state |= stateEnum.MESSAGES_LOST;
    }
    else {
      this.state &= ~stateEnum.MESSAGES_LOST;
    }

    this.lastHeartbeat = Date.now();
  }

  /**
   * Handles a node eviction message.
   * @param  {Object} message - decoded NodeEvicted protobuf message
   */
  handleNodeEviction (message) {
    if (message.nodeId === this.localNode.nodeId) {
      this.kuzzle.log.error(`[FATAL] Node evicted by ${message.evictor}. Reason: ${message.reason}`);
      this.kuzzle.shutdown();
      return;
    }

    return this.localNode.evictNode(message.nodeId, {
      broadcast: false,
      reason: message.reason,
    });
  }

  /**
   * Checks that we did receive a heartbeat from the remote node
   * If a heartbeat is missing, we allow 1 heartbeat round for the remote node
   * to recover, otherwise we evict it from the cluster.
   */
  async checkHeartbeat () {
    const now = Date.now();

    if ((now - this.lastHeartbeat) > this.localNode.heartbeatDelay) {
      if (this.state & stateEnum.MISSING_HEARTBEAT) {
        await this.dispose();
        this.localNode.evictNode(this.remoteNodeId, {
          broadcast: true,
          reason: 'heartbeat timeout',
        });
      }
      else {
        this.state |= stateEnum.MISSING_HEARTBEAT;
      }
    }
    else {
      this.state = ~stateEnum.MISSING_HEARTBEAT;
    }
  }

  /**
   * Disconnects from the remote node, and frees all allocated resources.
   */
  dispose () {
    if (this.state & stateEnum.EVICTED) {
      return;
    }

    this.state |= stateEnum.EVICTED;
    this.socket.close();
    this.socket = null;
    clearInterval(this.heartbeatTimer);
  }

  /**
   * Checks that the received message is the one we expect.
   * Only messages with a "messageId" field can be checked (only sync messages
   * have an incremental message ID)
   * @param  {Object} message - decoded protobuf message
   */
  checkMessageId (message) {
    if (!has(message, 'messageId')) {
      return;
    }

    if (this.lastMessageId + 1 !== message.messageId) {
      this.kuzzle.log.error(`[FATAL] Node out-of-sync: ${message.messageId - this.lastMessageId - 1} messages lost from node ${this.remoteNodeId}`);
      this.kuzzle.shutdown();
      return;
    }

    this.lastMessageId++;
  }
}

module.exports = ClusterSubscriber;
