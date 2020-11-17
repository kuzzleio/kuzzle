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

const requestTypeEnum = Object.freeze({
  FULLSTATE: 1,
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
  async listen () {
    this.server = new Reply();
    await this.server.bind(`tcp://*:${this.localNode.config.ports.request}`);

    this.state = stateEnum.RUNNING;

    while (this.state === stateEnum.RUNNING) {
      let type;

      try {
        [type] = await this.server.receive();
      }
      catch (e) {
        if (this.state !== stateEnum.CLOSED) {
          throw e;
        }
      }

      switch (type) {
        case requestTypeEnum.FULLSTATE:
          await this.sendFullstate();
          break;
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
  async sendFullstate () {
    const fullstate = this.node.fullstate.serialize();
    const protoEncode = this.protoroot.lookupType('FullstateResponse');
    const buffer = protoEncode.encode(protoEncode.create(fullstate)).finish();

    await this.server.send([requestTypeEnum.FULLSTATE, buffer]);
  }
}

module.export = ClusterCommand;
