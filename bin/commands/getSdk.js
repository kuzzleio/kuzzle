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

const {
  Kuzzle,
  Http,
  WebSocket
} = require('kuzzle-sdk');

/**
 *  Instantiate the SDK
 *  First log the user if credentials are provided
 *  then send the action to corresponding controller
 *
 *  @param {object} options
 *  @return {Promise}
 */
function getSdk (options, protocol = 'http') {
  const config = {
    host: options.host || 'localhost',
    port: options.port || 7512
  };

  if (options.username && options.password) {
    config.login = {
      strategy: 'local',
      credentials: {
        username: options.username,
        password: options.password
      }
    };
  }

  let networkProtocol;
  if (protocol === 'http') {
    networkProtocol = new Http(config.host, { port: config.port });
  } else {
    networkProtocol = new WebSocket(config.host, { port: config.port });
  }

  const kuzzle = new Kuzzle(networkProtocol);

  return kuzzle.connect()
    .then(() => {
      if (config.login) {
        return kuzzle.auth.login(config.login.strategy, config.login.credentials);
      }
    })
    .then(() => kuzzle);
}

module.exports = getSdk;
