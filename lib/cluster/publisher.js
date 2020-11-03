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

const { Publisher } = require('zeromq');
const protobuf = require('protobufjs');

// Handles messages publication to other nodes

class ClusterPublisher {
  /**
   * @constructor
   * @param  {ClusterNode} node
   */
  constructor (node) {
    this.kuzzle = node.kuzzle;
    this.node = node;
    this.lastMessageId = 0;
    this.socket = null;
    this.protoroot = null;
  }

  async init () {
    this.socket = new Publisher();
    this.socket.connect(this.node.address);
    this.protoroot = await protobuf.load('./protobuf/sync.proto');
  }

  /**
   * Broadcasts a sync message. Topic must match a protobuf type name.
   * @param  {String} topic name
   * @param  {Object} data
   * @throws If the topic's protobuf type cannot be found
   */
  async send (topic, data) {
    this.lastMessageId++;
    const payload = Object.assign({ messageId: this.lastMessageId }, { data });

    const type = this.protoroot.lookupType(topic);
    const buffer = type.encode(type.create(payload)).finish();

    await this.socket.send([topic, buffer]);
  }

  async dispose () {
    this.socket.close();
    this.socket = null;
  }
}

module.exports = ClusterPublisher;
