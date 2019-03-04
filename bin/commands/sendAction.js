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

const { Kuzzle, WebSocket } = require('kuzzle-sdk');

/**
 *  Send an action through the API
 *  First log the user if credentials are provided
 *  then send the action to corresponding controller
 *
 *  @param {object} options
 *  @param {string} controller
 *  @param {string} action
 *  @param {object} query
 *  @return {Promise}
 */
function sendAction (query, options) {
  const config = {
    host: options.parent.host || 'localhost',
    port: options.parent.port || 7512
  };

  if (options.parent.username && options.parent.password) {
    config.login = {
      strategy: 'local',
      credentials: {
        username: options.parent.username,
        password: options.parent.password
      }
    };
  }

  const kuzzle = new Kuzzle(new WebSocket(config.host, { port: config.port }));

  return kuzzle.connect()
    .then(() => {
      if (config.login) {
        return kuzzle.auth.login(config.login.strategy, config.login.credentials);
      }
    })
    .then(() => kuzzle.query(query));
}

module.exports = sendAction;
