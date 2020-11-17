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

const { Reply, Request } = require('zeromq');
const protobuf = require('protobufjs');

/* eslint-disable sort-keys */
const stateEnum = Object.freeze({
  INITIALIZING: 1,
  RUNNING: 2,
  CLOSED: 3,
});

const topicEnum = Object.freeze({
  FULLSTATE: 'fullstate',
  HANDSHAKE: 'handshake',
  DISCARDED: 'discarded', // 0 byte message expected
});
/* eslint-enable sort-keys */

// Handles bidirectional requests between this node and other nodes
class ClusterCommand {
  /**
   * @constructor
   * @param {ClusterNode} localNode
   */
  constructor (localNode) {
    this.node = localNode;
    this.server = null;
    this.protoroot = null;

    this.state = stateEnum.INITIALIZING;
  }

  async init () {
    this.protoroot = await protobuf.load('./protobuf/command.proto');
  }

  /**
   * Listens to incoming requests and answer to them.
   * Do NOT await this method, it's meant to run indefinitely until the close()
   * method is invoked.
   * @returns {void}
   */
  async serve () {
    this.server = new Reply();
    await this.server.bind(`tcp://*:${this.localNode.config.ports.request}`);

    this.state = stateEnum.RUNNING;

    while (this.state === stateEnum.RUNNING) {
      try {
        const [type, data] = await this.server.receive();

        switch (type) {
          case topicEnum.FULLSTATE:
            await this.sendfullState();
            break;
          case topicEnum.HANDSHAKE:
            await this.handleHandshake(data);
            break;
          default:
            // REP/REQ sockets expect a reply to each request made, so we have
            // to send some kind of response on an invalid request received
            await this.server.send([topicEnum.DISCARDED, null]);
        }
      }
      catch (e) {
        if (this.state !== stateEnum.CLOSED) {
          throw e;
        }
      }
    }
  }

  /**
   * Closes opened sockets and marks this server as closed.
   * @return {void}
   */
  dispose () {
    this.state = stateEnum.CLOSED;
    this.server.close();
  }

  /**
   * Sends back the full state to the requesting node
   * @return {void}
   */
  async sendFullState () {
    const fullState = this.node.fullState.serialize();
    const protoEncode = this.protoroot.lookupType('FullstateResponse');
    const buffer = protoEncode.encode(protoEncode.create(fullState)).finish();

    await this.server.send([topicEnum.FULLSTATE, buffer]);
  }

  /**
   * Handles a handshake request from a remote node
   * @return {void}
   */
  async handleHandshake (data) {
    const decoder = this.protoroot.lookupType('HandshakeRequest');
    const { nodeId, ip, lastMessageId } = decoder.decode(data).toJSON();

    const added = await this.node.addNode(nodeId, ip, lastMessageId);

    const encoder = this.protoroot.lookupType('HandshakeResponse');
    const response = {
      added,
      lastMessageId: this.node.publisher.lastMessageId,
    };

    const buffer = encoder.encode(encoder.create(response)).finish();

    await this.server.send([topicEnum.HANDSHAKE, buffer]);
  }

  /**
   * Request the full state from ONE of the remote nodes of the cluster, AT
   * RANDOM (necessary to make sure we distribute the full state serialization
   * load across all nodes)
   *
   * @param  {Array.<Array>} nodes
   * @return {Object|null} Returns the fetched full state, or null if no node answered
   */
  async getFullState (nodes) {
    let idx = Math.floor(Math.random() * Math.floor(nodes.length));
    let fullState = null;

    for (let retries = 0; fullState === null && retries < nodes.length; retries++) {
      let ip = nodes[idx][1];

      const req = new Request();

      req.receiveTimeout = 2000;

      req.connect(`tcp://${ip}:${this.config.ports.command}`);

      // No payload message for a full state request
      await req.send([topicEnum.FULLSTATE, null]);

      try {
        [, fullState] = await req.receive();
      }
      catch (e) {
        // no response from the remote node in a timely fashion... retrying
        // with another one
        idx = (idx + 1) % nodes.length;
      }
    }

    return fullState;
  }
}

module.export = ClusterCommand;
