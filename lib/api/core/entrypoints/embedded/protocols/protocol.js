/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
const
  assert = require('assert'),
  bytes = require('bytes'),
  http = require('http');

class Protocol {
  constructor() {
    this.maxRequestSize = null;
    this.entryPoint = null;
    this.name = null;
    this.config = {};
  }

  /**
   * @param {string} name - Protocol name (used for accessor)
   * @param {EmbeddedEntryPoint} entryPoint
   *
   * @return {Promise<boolean>}
   */
  init(name, entryPoint) {
    this.entryPoint = entryPoint;

    return Promise.resolve()
      .then(() => {
        this.name = name;
        this.maxRequestSize = bytes.parse(entryPoint.config.maxRequestSize);

        assert(
          typeof this.name === 'string' && this.name.length > 0,
          'Invalid "name" parameter value: expected a non empty string value');

        if (entryPoint.config.protocols && entryPoint.config.protocols[name]) {
          this.config = entryPoint.config.protocols[name];
        }

        assert(
          Number.isInteger(this.maxRequestSize),
          'Invalid "maxRequestSize" parameter value: expected a numeric value');

        return true;
      });
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
   * @return {Array.<string>} List of IP addresses
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
