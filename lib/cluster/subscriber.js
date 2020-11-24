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
const Long = require('long');

const { has } = require('../util/safeObject');

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
   * @param {string} remoteNodeAddress - address of the distant node
   */
  constructor (localNode, remoteNodeId, remoteNodeAddress) {
    this.kuzzle = localNode.kuzzle;

    // not to be confused with remote nodes
    this.localNode = localNode;

    this.remoteNodeAddress = remoteNodeAddress;
    this.remoteNodeId = remoteNodeId;
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
    this.lastHeartbeat = null;
    this.heartbeatDelay = this.localNode.heartbeatDelay * 1.2;
  }

  /**
   * Initializes this class, establishes a connection to the remote node and
   * starts listening to it.
   */
  async init () {
    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
    this.socket = new Subscriber();
    this.socket.connect(this.remoteNodeAddress);
    this.socket.subscribe();
    this.heartbeatTimer = setInterval(
      () => this.checkHeartbeat(),
      this.heartbeatDelay);

    this.listen();
  }

  /**
   * Starts subscribing to other nodes
   * Do NOT wait this method: it's an infinite loop, it's not meant to ever
   * return (unless the remote node has been evicted)
   */
  async listen () {
    while (this.state !== stateEnum.EVICTED) {
      let topic;
      let data;

      try {
        [topic, data] = await this.socket.receive();
      }
      catch (e) {
        if (this.state !== stateEnum.EVICTED) {
          await this.localNode.evictNode(this.remoteNodeId, {
            broadcast: true,
            reason: e.message,
          });
        }

        return;
      }

      if (this.state !== stateEnum.BUFFERING) {
        await this.processData(topic.toString(), data);
      }
      else {
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
  async sync (lastMessageId) {
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
  async processData (topic, data) {
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const decoder = this.protoroot.lookup(topic);

    if (decoder === null) {
      await this.localNode.evictNode(this.remoteNodeId, {
        broadcast: true,
        reason: `received an invalid message from ${this.remoteNodeId} (unknown topic "${topic}")`,
      });
      return;
    }

    const message = decoder.toObject(decoder.decode(data));

    if (!await this.validateMessage(message)) {
      return;
    }

    try {
      switch (topic) {
        case 'Heartbeat':
          this.handleHeartbeat();
          break;
        case 'NodeEvicted':
          await this.handleNodeEviction(message);
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
   *
   * @return {void}
   */
  handleHeartbeat () {
    this.lastHeartbeat = Date.now();
  }

  /**
   * Handles a node eviction message.
   *
   * @param  {Object} message - decoded NodeEvicted protobuf message
   * @return {void}
   */
  async handleNodeEviction (message) {
    if (message.nodeId === this.localNode.nodeId) {
      this.kuzzle.log.error(`[FATAL] Node evicted by ${message.evictor}. Reason: ${message.reason}`);
      this.kuzzle.shutdown();
      return;
    }

    await this.localNode.evictNode(message.nodeId, {
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
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const now = Date.now();

    if ( this.lastHeartbeat !== null &&
       (now - this.lastHeartbeat) > this.heartbeatDelay
    ) {
      if (this.state === stateEnum.MISSING_HEARTBEAT) {
        await this.localNode.evictNode(this.remoteNodeId, {
          broadcast: true,
          reason: 'heartbeat timeout',
        });
      }
      else {
        this.state = stateEnum.MISSING_HEARTBEAT;
      }
    }
    else {
      this.state = stateEnum.SANE;
    }
  }

  /**
   * Disconnects from the remote node, and frees all allocated resources.
   */
  dispose () {
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
  async validateMessage (message) {
    if (!has(message, 'messageId')) {
      this.kuzzle.log.warn(`Invalid message received from node ${this.remoteNodeId}. Evicting it.`);
      await this.localNode.evictNode(this.remoteNodeId, {
        broadcast: true,
        reason: 'invalid message received (missing "messageId" field)',
      });
      return false;
    }

    if ( this.state === stateEnum.BUFFERING
      && this.lastMessageId.greaterThan(message.messageId)
    ) {
      return false;
    }

    this.lastMessageId = this.lastMessageId.add(1);

    if (this.lastMessageId.notEquals(message.messageId)) {
      this.kuzzle.log.error(`[FATAL] Node out-of-sync: ${message.messageId - this.lastMessageId - 1} messages lost from node ${this.remoteNodeId}`);
      this.kuzzle.shutdown();
      return false;
    }

    return true;
  }
}

module.exports = ClusterSubscriber;
