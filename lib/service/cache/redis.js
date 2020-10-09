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

const { flatten, uniq } = require('lodash');
const Bluebird = require('bluebird');
const IORedis = require('ioredis');

const kerror = require('../../kerror').wrap('services', 'cache');
const Service = require('../service');

/**
 * @class Redis
 * @extends Service
 * @param {Kuzzle} kuzzle
 * @param {object} config
 * @property service
 */
class Redis extends Service {
  constructor(kuzzle, config) {
    super('redis', kuzzle, config);

    this.connected = false;
    this.client = null;
    this.commands = {};
  }

  /**
   * Initialize the redis client, select the service associated database and
   * flush it to make sure we start from a clean state
   *
   * @returns {Promise}
   */
  _initSequence() {
    if (this._config.nodes) {
      this.client = this._buildClusterClient();
    }
    else {
      this.client = this._buildClient();
    }

    this.client.on('ready', () => {
      this.connected = true;
    });

    this.client.on('error', error => {
      if (this.connected) {
        this._kuzzle.log.error(`Redis service seem to be down, see original error for more info:\n${error.message}`);
      }
      this.connected = false;
    });

    this.setCommands();

    return new Bluebird((resolve, reject) => {
      this.client.once('ready', () => {
        if (this._config.database > 0) {
          this.client.select(
            this._config.database,
            error => error ? reject(error) : resolve());
        }
        else {
          resolve();
        }
      });

      this.client.once('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Initializes the Redis commands list, and add transformers when necessary
   */
  setCommands () {
    const commandsList = this.client.getBuiltinCommands();

    for (const command of commandsList) {
      this.commands[command] = async (...args) => {
        if (!this.connected) {
          throw kerror.get('notconnected');
        }

        return this.client[command](...args);
      };
    }
  }

  /**
   * Return some basic information about this service
   * @override
   *
   * @returns {Promise} service informations
   */
  async info () {
    const result = await this.commands.info();
    const arr = result.replace(/\r\n/g, '\n').split('\n');
    const info = {};

    arr.forEach(item => {
      item = item.trim();
      if (item.length > 0 && !item.startsWith('#')) {
        const keyValuePair = item.split(':');
        info[keyValuePair[0]] = keyValuePair[1];
      }
    });

    return {
      memoryPeak: info.used_memory_peak_human,
      memoryUsed: info.used_memory_human,
      mode: info.redis_mode,
      type: 'redis',
      version: info.redis_version,
    };
  }

  /**
   * Returns all the keys matching a given pattern.
   *
   * /!\ We don't use `keys` to avoid blocking Redis if using a big dataset
   * cf: http://redis.io/commands/keys
   *     and http://redis.io/commands/scan
   *
   * @param pattern
   * @returns {Promise} promise resolving to an array of keys
   */
  async searchKeys (pattern) {
    if (this.client instanceof IORedis.Cluster) {
      const keys = await Bluebird.map(this.client.nodes('master'), node => {
        return this._searchNodeKeys(node, pattern);
      });

      return uniq(flatten(keys));
    }

    return this._searchNodeKeys(this.client, pattern);
  }

  /**
   * Executes multiple client commands in a single action
   *
   * @returns {Promise}
   */
  mExecute (commands) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return Bluebird.resolve([]);
    }

    return this.client
      .multi(commands)
      .exec();
  }

  _searchNodeKeys (node, pattern) {
    return new Bluebird(resolve => {
      let keys = [];
      const stream = node.scanStream({match: pattern});

      stream.on('data', resultKeys => {
        keys = keys.concat(resultKeys);
      });

      stream.on('end', () => {
        resolve(uniq(keys));
      });
    });
  }

  _buildClient () {
    return new IORedis(this._config.node);
  }

  _buildClusterClient () {
    return new IORedis.Cluster(this._config.nodes, { enableReadyCheck: true });
  }

  /**
   * Convenience method: set a key and its value
   *
   * Options:
   *   - onlyIfNew: if true, set the NX option
   *   - ttl: if true, set the PX option
   *
   * @param  {string} key
   * @param  {string} value
   * @param  {{onlyIfNew: boolean, ttl: number}} [options]
   * @return {boolean} true if the key was set, false otherwise
   */
  async store (key, value, {onlyIfNew = false, ttl = 0} = {}) {
    const command = [key, value];

    if (onlyIfNew) {
      command.push('NX');
    }

    if (ttl > 0) {
      command.push('PX', ttl);
    }

    const result = await this.commands.set(...command);

    return result === 'OK';
  }

  /**
   * Executes a client command
   * @param  {string} command
   * @param  {Array} args
   * @return {Promise.<*>}
   */
  exec (command, ...args) {
    return this.commands[command](...args);
  }
}

module.exports = Redis;
