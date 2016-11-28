var
  _ = require('lodash'),
  Promise = require('bluebird'),
  util = require('util'),
  IORedis = require('ioredis'),
  ServiceUnavailableError = require('kuzzle-common-objects').Errors.serviceUnavailableError,
  Service = require('./service');

/**
 * @param {Kuzzle} kuzzle
 * @param {Object} options
 * @param {Object} config
 * @property service
 * @constructor
 */
function Redis (kuzzle, options, config) {
  this.connected = false;
  this.client = null;
  this.initialized = null;
  this.commands = [];

  Object.defineProperties(this, {
    settings: {
      writable: true,
      value: {
        service: options.service
      }
    }
  });


  /**
   * Initialize the redis client, select the service associated database and flush it to make sure we start
   * from a clean slate
   *
   * @returns {Promise} client
   */
  this.init = function redisInit () {
    this.client = buildClient(config);

    this.client.on('ready', () => {
      this.connected = true;
      kuzzle.pluginsManager.trigger('log:info', 'Redis service: Connected to ' + this.settings.service);
    });

    this.client.on('error', error => {
      if (this.connected) {
        kuzzle.pluginsManager.trigger('log:error', 'Redis service seem to be down, see original error for more info:\n' + error.message);
      }
      this.connected = false;
    });

    this.commands = this.client.getBuiltinCommands();

    // Canonical implementations. Just wrapping redis client library into promises
    this.commands.forEach(command => {
      if (this[command]) {
        // do not override existing method
        return;
      }

      // cannot convert this into an arrow function because of usage of 'arguments' variable
      this[command] = function wrapRedisCommand () {
        if (!this.connected) {
          return Promise.reject(new ServiceUnavailableError('Redis service is not connected'));
        }

        return this.client[command].apply(this.client, arguments);
      }.bind(this);
    });

    return new Promise((resolve, reject) => {
      this.client.once('ready', () => {
        if (config.database > 0) {
          return this.client.select(config.database, error => error ? reject(error) : resolve(this));
        }
        resolve(this);
      });

      this.client.once('error', error => {
        reject(error);
      });
    });
  };

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  this.getInfos = function redisGetInfos () {
    var response = {
      type: 'redis'
    };

    return this.client.info()
      .then(res => {
        var
          arr = res.split('\r\n'),
          infos = {},
          keyValuePair;

        arr.forEach(item => {
          if (item.length > 0 && !item.startsWith('#')) {
            keyValuePair = item.split(':');
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
  };

  /**
   * Add one or multiple value to a key
   *
   * @param {String} key
   * @param {String|Array} values
   * @return {Promise} Number of values created
   */
  this.add = function redisAdd (key, values) {
    var
      addSet = [key];

    if (!values) {
      return Promise.resolve(0);
    }

    if (typeof values === 'string') {
      addSet.push(values);
    } else {
      if (values.length === 0) {
        return Promise.resolve(0);
      }
      addSet = addSet.concat(values);
    }

    return this.client.sadd(addSet);
  };

  /**
   * Remove one or multiple value(s) from a key
   * If the "values" argument is empty, removes the key completely
   *
   *  @param {String} key
   *  @param {String|Array} values
   *  @return {Promise} Number of values deleted
   */
  this.remove = function redisRemove (key, values) {
    if (values && values.length > 0) {
      return this.client.srem(key, values);
    }

    return this.client.del(key);
  };

  /**
   * Returns all values corresponding to a key
   *
   * @param {String} key
   * @return {Promise} Array of retrieved value(s)
   */
  this.search = function redisSearch (key) {
    return this.client.smembers(key);
  };

  /**
   * Create or update a key with a new value, and add a TTL to it
   *
   * @param {string} key
   * @param {string} value
   * @param {string} ttl - in seconds
   * @returns {Promise}
   */
  this.volatileSet = function redisVolatileSet (key, value, ttl) {
    return this.client.setex(key, ttl, value);
  };

  /**
   * Sets or updates a timeout on a key
   *
   * @param {String} key
   * @param {Number} timestamp time where the key should be deleted
   * @returns {Promise}
   */
  this.expireAt = function redisExpireAt (key, timestamp) {
    // expireat is defined at initialization
    return this.expireat(key, timestamp);
  };

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
  this.searchKeys = function redisSearchKeys (pattern) {
    return new Promise(resolve => {
      var
        keys = [],
        stream = this.client.scanStream({
          match: pattern
        });

      stream.on('data', resultKeys => {
        keys = keys.concat(resultKeys);
      });

      stream.on('end', () => {
        resolve(_.uniq(keys));
      });
    });
  };

  /**
   * Returns all the known keys of this database
   *
   * @returns {Promise} promise resolving to an array of keys
   */
  this.getAllKeys = function redisGetAllKeys () {
    return this.searchKeys('*');
  };

  /**
   * Gets the value of an array of keys
   *
   * @returns {Promise}
   */
  this.mget = function redisMget () {
    var
      args = Array.prototype.slice.call(arguments);

    if (args && args[0] && _.isArray(args[0])) {
      args = args[0];
    }

    if (args.length === 0) {
      return Promise.resolve([]);
    }

    return this.client.mget(args);
  };

}

util.inherits(Redis, Service);

module.exports = Redis;


function buildClient (config) {
  if (config.nodes) {
    return new IORedis.Cluster(config.nodes, {enableReadyCheck: true});
  }

  return new IORedis(config.node);
}
