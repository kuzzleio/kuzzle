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
  {
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors,
  bytes = require('bytes');

class Protocol {
  constructor() {
    this.maxRequestSize = null;
    this.entryPoint = null;
    this.name = null;
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

        if (typeof this.name !== 'string' || this.name.length <= 0) {
          throw new KuzzleInternalError('Invalid "name" parameter value: expected a non empty string value');
        }

        this.maxRequestSize = bytes.parse(entryPoint.config.maxRequestSize);

        if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
          throw new KuzzleInternalError('Invalid "maxRequestSize" parameter value: expected a numeric value');
        }
    
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

}

module.exports = Protocol;
