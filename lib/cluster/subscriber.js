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
const { Subscriber } = require('zeromq');
const protobuf = require('protobufjs');

// Handles messages received from other nodes

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

    // keeps track of received message ids from the remote node
    this.lastMessageId = lastMessageId;

    // keeps track of the remote node heartbeats, and removes it if no
    // heartbeats have been received after some time
    this.heartbeatTimer = null;
    this.lastHeartbeat = null;
  }

  /**
   * Starts subscribing to other nodes
   * @return {[type]} [description]
   */
  async init () {
    this.protoroot = await protobuf.load('./protobuf/sync.proto');
    this.socket = new Subscriber();
    this.socket.connect(this.remoteNodeAddress);



    try {
      for (const [topic, data] of await this.socket) {
        await this.decode(topic, data);
      }
    }
    catch (e) {
      // socket is null if closed on purpose
      if (this.socket !== null) {
        this.localNode.removeNode(this.address, e);
      }
    }
  }

  /**
   * Decodes an incoming message, and dispatches it.
   * The topic name must match a protobuf message.
   *
   * @param  {string} topic
   * @param  {Buffer} data
   */
  async decode (topic, data) {
    const type = this.protoroot.lookup(topic);

    if (type === null) {
      debug(
        'Receive an invalid message from %s: unknown topic "%s"',
        this.remoteNodeId,
        topic);

      return;
    }

    const message = type.decode(data).toJSON();

    switch (topic) {
      case 'Heartbeat':
        return this.handleHeartbeat(message);
    }
  }

  /**
   * Handles a heartbeat from the remote node
   * @param  {Object} message
   */
  async handleHeartbeat (message) {
    if (message.lastMessageId !== this.lastMessageId) {
      this.kuzzle.log.error(`[FATAL] Node out-of-sync: lost ${this.lastMessageId - message.lastMessageId} messages from node ${this.remoteNodeId}`);
      this.kuzzle.shutdown();
    }
  }

  async dispose () {
    this.socket.close();
    this.socket = null;
  }
}

module.exports = ClusterSubscriber;
