/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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
 * @param {object} config
 * @property service
 */
class Redis extends Service {
  constructor (config, name) {
    super('redis', config);

    this.connected = false;
    this.client = null;
    this.commands = {};
    this.adapterName = name;
    this.pingIntervalID = null;
  }

  /**
   * Initialize the redis client, select the service associated database and
   * flush it to make sure we start from a clean state
   *
   * @returns {Promise}
   */
  _initSequence () {
    const config = JSON.parse(JSON.stringify(this._config));

    // Only way to connect to AWS ELastiCache
    // https://github.com/luin/ioredis#special-note-aws-elasticache-clusters-with-tls
    if (config.overrideDnsLookup) {
      config.clusterOptions.dnsLookup = (address, callback) => callback(null, address);
    }

    if (config.nodes) {
      this.client = this._buildClusterClient(
        { ...config.clusterOptions, redisOptions: config.options });
    }
    else {
      this.client = this._buildClient(config.options);
    }

    this.client.on('ready', () => {
      this.connected = true;
    });

    this.client.on('error', error => {
      if (this.connected) {
        global.kuzzle.log.error(`Redis service seem to be down, see original error for more info:\n${error.message}`);
      }
      this.connected = false;
    });

    this.setCommands();
    // TODO: Remove this when IORedis does support application level pings to keep connection to Azure Redis alive
    if (config.pingKeepAlive && config.pingKeepAlive > 0) {
      this._setupKeepAlive(config.pingKeepAlive);
    }

    return new Bluebird((resolve, reject) => {
      this.client.once('ready', async () => {
        await this.client.client('SETNAME', `${this.adapterName}/${global.kuzzle.id}`);
        resolve();
      });

      this.client.once('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Setup a ping interval to keep the connection alive
   * Every 60 seconds a ping is sent to Redis
   */
  _setupKeepAlive (delay) {
    this.client.on('ready', async () => {
      await this._ping();
      this.pingIntervalID = setInterval(this._ping.bind(this), delay);
    });

    this.client.on('error', () => {
      clearInterval(this.pingIntervalID);
      this.pingIntervalID = null;
    });
  }

  /**
   * Ping Redis
   */
  async _ping () {
    try {
      await this.client.ping();
    }
    catch (error) {
      global.kuzzle.log.error(`Failed to PING Redis to keep connection alive:\n${error.message}`);  
    }
  }

  /**
   * Initializes the Redis commands list, and add transformers when necessary
   */
  setCommands () {
    const commandsList = this.client.getBuiltinCommands();

    for (const command of commandsList) {
      this.commands[command] = async (...args) => {
        if (! this.connected) {
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
      if (item.length > 0 && ! item.startsWith('#')) {
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
   * @returns {Promise.<string[]>} promise resolving to an array of keys
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
    if (! Array.isArray(commands) || commands.length === 0) {
      return Bluebird.resolve([]);
    }

    return this.client
      .multi(commands)
      .exec();
  }

  _searchNodeKeys (node, pattern) {
    return new Bluebird(resolve => {
      let keys = [];
      const stream = node.scanStream({ match: pattern });

      stream.on('data', resultKeys => {
        keys = keys.concat(resultKeys);
      });

      stream.on('end', () => {
        resolve(uniq(keys));
      });
    });
  }

  _buildClient (options) {
    return new IORedis({ ...this._config.node, ...options });
  }

  _buildClusterClient (options) {
    return new IORedis.Cluster(this._config.nodes, options);
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
  async store (key, value, { onlyIfNew = false, ttl = 0 } = {}) {
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
