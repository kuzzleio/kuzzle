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
  Bluebird = require('bluebird'),
  EmbeddedEntryPoint = require('./embedded'),
  ProxyEntryPoint = require('./proxy');

class Entrypoints {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    /** {{ EntryPoint[] }} */
    this.entryPoints = [];

    if (kuzzle.config.server.entryPoints.embedded) {
      this.entryPoints.push(new EmbeddedEntryPoint(kuzzle));
    }

    if (kuzzle.config.server.entryPoints.proxy) {
      this.entryPoints.push(new ProxyEntryPoint(kuzzle));
    }
  }

  dispatch (event, data) {
    for (const entrypoint of this.entryPoints) {
      entrypoint.dispatch(event, data);
    }
  }

  init () {
    return Bluebird.all(this.entryPoints.map(entrypoint => entrypoint.init()));
  }

  joinChannel (channel, connectionId) {
    for (const entrypoint of this.entryPoints) {
      entrypoint.joinChannel(channel, connectionId);
    }
  }

  leaveChannel (channel, connectionId) {
    for (const entrypoint of this.entryPoints) {
      entrypoint.leaveChannel(channel, connectionId);
    }
  }
}

module.exports = Entrypoints;
