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

const
  debug = require('../../kuzzleDebug')('kuzzle:broker'),
  WSBrokerClient = require('./wsBrokerClient'),
  WSBrokerServer = require('./wsBrokerServer');

/**
 * @param {string} brokerType
 * @param {boolean} [client]
 * @param {boolean} [notifyOnListen]
 * @returns {WSBrokerClient|WSBrokerServer}
 */
module.exports = function brokerFactory (brokerType, client, notifyOnListen) {
  let _client = client;

  return function brokerInit (kuzzle, opts, config) {
    debug('[%s] initialize broker service as %s', brokerType, client ? 'client' : 'server');

    if (opts && opts.client !== undefined) {
      _client = opts.client;
    }

    if (!config) {
      throw new Error(`No configuration found for broker ${brokerType}. Are you sure this broker exists?`);
    }
    
    return _client
      ? new WSBrokerClient(brokerType, config, kuzzle.pluginsManager, notifyOnListen)
      : new WSBrokerServer(brokerType, config, kuzzle.pluginsManager);
  };
};

