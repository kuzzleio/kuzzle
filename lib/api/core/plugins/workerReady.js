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

const PluginContext = require('./pluginContext');

let
  plugin = null,
  config = {},
  kuzzleConfig = {};

module.exports = function ready () {
  process.on('message', packet => {
    /** @type {{data: {name: String, path:String}}} packet */

    if (packet.topic === 'initialize') {
      try {
        if (!packet.data.path) {
          // Get the cluster worker name. The environment variable "name" is populated by PM2
          plugin = new (require(process.env.name.replace(packet.data.kuzzleConfig.plugins.common.workerPrefix, '')))();
        }
        else {
          plugin = new (require(packet.data.path))();
        }

        kuzzleConfig = packet.data.kuzzleConfig;
        config = packet.data.config;

        plugin.init(config, new PluginContext({config: kuzzleConfig}));
        process.send({
          type: 'initialized',
          data: {
            events: Object.keys(plugin.hooks)
          }
        });
      }
      catch (e) {
        /*eslint-disable no-console */
        console.error(`ERROR: Unable to initialize worker plugin: ${e.message}`, e.stack);
        /*eslint-enable no-console */
      }
    }

    if (packet.topic === 'trigger' && plugin.hooks[packet.data.event]) {
      if (Array.isArray(plugin.hooks[packet.data.event])) {
        plugin.hooks[packet.data.event]
          .filter(target => typeof plugin[target] === 'function')
          .forEach(func => plugin[func](packet.data.message, packet.data.event));
      }
      else if (typeof plugin[plugin.hooks[packet.data.event]] === 'function') {
        plugin[plugin.hooks[packet.data.event]](packet.data.message, packet.data.event);
      }
      else {
        // eslint-disable-next-line no-console
        console.error(`Unable to register "${plugin.hooks[packet.data.event]}": not a function nor an array of functions. Ignoring...`);
      }
    }
  });

  process.send({
    type: 'ready',
    data: {}
  });
};
