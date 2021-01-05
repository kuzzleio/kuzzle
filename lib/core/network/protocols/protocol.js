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
const http = require('http');

const bytes = require('../../../util/bytes');

class Protocol {
  constructor (name) {
    this.maxRequestSize = null;
    this.entryPoint = null;
    this.name = name;
    this.config = {};

    this.initCalled = false;

    Reflect.defineProperty(this, '_kuzzle', {
      value: null,
      writable: true
    });
  }

  /**
   * @param {string} name - Protocol name (used for accessor) @deprecated
   * @param {EmbeddedEntryPoint} entryPoint
   *
   * @returns {Promise<boolean>}
   */
  async init(name, entryPoint) {
    this.entryPoint = entryPoint;

    // name should be passed in the constructor
    assert(
      this.name && ! name,
      'A name has been given in the constructor and init method. Passing the name in the init method is deprecated.');

    if (! this.name) {
      this.name = name;
    }

    this.maxRequestSize = bytes(entryPoint.config.maxRequestSize);

    assert(
      typeof this.name === 'string' && this.name.length > 0,
      'Invalid "name" parameter value: expected a non empty string value');

    if (entryPoint.config.protocols && entryPoint.config.protocols[this.name]) {
      this.config = entryPoint.config.protocols[this.name];
    }

    assert(
      Number.isInteger(this.maxRequestSize),
      'Invalid "maxRequestSize" parameter value: expected a numeric value');

    this.initCalled = true;

    return true;
  }

  broadcast () {
    // do nothing by default
  }

  joinChannel (channel, connectionId) {
    // do nothing by default
    return {channel, connectionId};
  }

  leaveChannel (channel, connectionId) {
    // do nothing by default
    return {channel, connectionId};
  }

  notify () {
    // do nothing by default
  }

  /**
   * Extract and return the list of IP addresses from a request made to a
   * protocol.
   *
   * @param  {*} request
   * @returns {Array.<string>} List of IP addresses
   */
  _getIps(request) {
    const ips = [];

    if (request instanceof http.IncomingMessage) {
      ips.push(request.socket.remoteAddress);

      if (request.headers['x-forwarded-for']) {
        for (const header of request.headers['x-forwarded-for'].split(',')) {
          const trimmed = header.trim();

          if (trimmed.length > 0) {
            ips.push(trimmed);
          }
        }
      }
    }

    return ips;
  }
}

module.exports = Protocol;
