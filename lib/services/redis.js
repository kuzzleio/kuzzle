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
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  IORedis = require('ioredis'),
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  Service = require('./service');

/**
 * @class Redis
 * @extends Service
 * @param {Kuzzle} kuzzle
 * @param {object} options
 * @param {object} config
 * @property service
 */
class Redis extends Service {
  constructor(kuzzle, options, config) {
    super();
    this._kuzzle = kuzzle;
    this._config = config;
    this._connected = false;
    this._client = null;
    this._commands = [];

    Object.defineProperties(this, {
      settings: {
        writable: true,
        value: {
          service: options.service
        }
      }
    });
  }


  /**
   * Initialize the redis client, select the service associated database and flush it to make sure we start
   * from a clean slate
   *
   * @returns {Promise} client
   */
  init() {
    this._client = buildClient(this._config);

    this._client.on('ready', () => {
      this._connected = true;
      this._kuzzle.emit('log:info', 'Redis service: Connected to ' + this.settings.service);
    });

    this._client.on('error', error => {
      if (this._connected) {
        this._kuzzle.emit('log:error', 'Redis service seem to be down, see original error for more info:\n' + error.message);
      }
      this._connected = false;
    });

    this._commands = this._client.getBuiltinCommands();

    // Canonical implementations. Just wrapping redis client library into promises
    this._commands.forEach(command => {
      if (this[command]) {
        // do not override existing method
        return;
      }

      // cannot convert this into an arrow function because of usage of 'arguments' variable
      this[command] = (...args) => {
        if (!this._connected) {
          return Bluebird.reject(new ServiceUnavailableError('Redis service is not connected'));
        }

        return this._client[command](...args);
      };
    });

    return new Bluebird((resolve, reject) => {
      this._client.once('ready', () => {
        if (this._config.database > 0) {
          return this._client.select(this._config.database, error => error ? reject(error) : resolve(this));
        }
        resolve(this);
      });

      this._client.once('error', error => {
        reject(error);
      });
    });

  }

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  getInfos() {
    const response = {
      type: 'redis'
    };

    return this._client.info()
      .then(res => {
        const
          arr = res.split('\r\n'),
          infos = {};

        arr.forEach(item => {
          if (item.length > 0 && !item.startsWith('#')) {
            const keyValuePair = item.split(':');
            infos[keyValuePair[0]] = keyValuePair[1];
          }
        });

        /** @type {{redis_version: String, redis_mode: String, used_memory_human: String, used_memory_peak_human: String}} infos */
        response.version = infos.redis_version;
        response.mode = infos.redis_mode;
        response.memoryUsed = infos.used_memory_human;
        response.memoryPeak = infos.used_memory_peak_human;
        return response;
      });
  }

  /**
   * Sets or updates a timeout on a key
   *
   * @param {string} key
   * @param {number} timestamp time where the key should be deleted
   * @returns {Promise}
   */
  expireAt(key, timestamp) {
    // expireat is defined at initialization
    return this._client.expireat(key, timestamp);
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
  searchKeys(pattern) {
    if (this._client instanceof IORedis.Cluster) {
      let keys = [];
      const promises = [];

      for (const node of this._client.nodes('master')) {
        promises.push(this._searchNodeKeys(node, pattern)
          .then(nodeKeys => { // eslint-disable-line no-loop-func
            keys = keys.concat(nodeKeys);
          }));
      }

      return Bluebird.all(promises)
        .then(() => _.uniq(keys));
    }

    return this._searchNodeKeys(this._client, pattern);
  }

  /**
   * Returns all the known keys of this database
   *
   * @returns {Promise} promise resolving to an array of keys
   */
  getAllKeys() {
    return this.searchKeys('*');
  }

  /**
   * Gets the value of an array of keys
   *
   * @returns {Promise}
   */
  mget(...args) {
    let _args = args;

    if (args[0] && Array.isArray(args[0])) {
      _args = args[0];
    }

    if (_args.length === 0) {
      return Bluebird.resolve([]);
    }

    return this._client.mget(_args);
  }

  _searchNodeKeys(node, pattern) {
    return new Bluebird(resolve => {
      let keys = [];
      const stream = node.scanStream({match: pattern});

      stream.on('data', resultKeys => {
        keys = keys.concat(resultKeys);
      });

      stream.on('end', () => {
        resolve(_.uniq(keys));
      });
    });

  }

}

module.exports = Redis;

function buildClient (config) {
  if (config.nodes) {
    return new IORedis.Cluster(config.nodes, {enableReadyCheck: true});
  }

  return new IORedis(config.node);
}
