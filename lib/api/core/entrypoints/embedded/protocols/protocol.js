/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
const bytes = require('bytes');

class Protocol {
  constructor() {
    this.maxRequestSize = null;
    this.entryPoint = null;
  }

  init(entryPoint) {
    this.entryPoint = entryPoint;
    this.maxRequestSize = bytes.parse(entryPoint.config.maxRequestSize);

    if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
      throw new Error('Invalid "maxRequestSize" parameter value: expected a numeric value');
    }
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
