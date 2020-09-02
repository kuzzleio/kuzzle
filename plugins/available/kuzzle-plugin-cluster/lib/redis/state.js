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

class State {
  constructor (raw) {
    this.version = raw[0] && parseInt(raw[0], 10) || 1;

    this.rooms = [];
    for (const v of raw[1]) {
      this.rooms.push({
        id: v[0],
        filter: v[1] && JSON.parse(v[1]),
        count: parseInt(v[2], 10)
      });
    }
  }

  static current (redis, index, collection) {
    return redis.clusterState(`{${index}/${collection}}`)
      .then(json => new State(json));
  }
}

module.exports = State;
