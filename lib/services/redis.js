var
  _ = require('lodash'),
  q = require('q'),
  util = require('util'),
  IORedis = require('ioredis'),
  InternalError = require('../api/core/errors/internalError'),
  Service = require('./service');

function Redis (kuzzle, options) {
  this.kuzzleConfig = kuzzle.config;
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
   * @returns {Object} client
   */
  this.init = function () {
    if (this.initialized) {
      return this.initialized.promise;
    }

    this.initialized = q.defer();

    if (this.kuzzleConfig.cache.databases.indexOf(this.settings.service) === -1) {
      this.initialized.reject(new InternalError('Unknown database: ', this.settings.service));
      return this.initialized.promise;
    }

    this.client = buildClient(this.kuzzleConfig.cache);

    this.client.on('ready', () => {
      this.client.select(this.kuzzleConfig.cache.databases.indexOf(this.settings.service), error => {
        if (error) {
          return this.initialized.reject(error);
        }

        // do not flush publicCache
        if (this.settings.service === 'memoryStorage') {
          return this.initialized.resolve(this);
        }

        this.client.flushdb(err => {
          if (err) {
            return this.initialized.reject(err);
          }
          this.initialized.resolve(this);
        });
      });
    });

    this.client.on('error', error => {
      this.initialized.reject(error);

      kuzzle.pluginsManager.trigger('log:error', error);
    });

    this.commands = this.client.getBuiltinCommands();

    // Canonical implementations. Just wrapping redis client library into promises
    this.commands.forEach(command => {
      if (this[command]) {
        // do not override existing method
        return;
      }

      this[command] = function () {
        return this.client[command].apply(this.client, arguments);
      }.bind(this);
    });

    return this.initialized.promise;
  };

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  this.getInfos = function () {
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
  this.add = function (key, values) {
    var
      addSet = [key];

    if (!values) {
      return q(0);
    }

    if (typeof values === 'string') {
      addSet.push(values);
    } else {
      if (values.length === 0) {
        return q(0);
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
  this.remove = function (key, values) {
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
  this.search = function (key) {
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
  this.volatileSet = function (key, value, ttl) {
    return this.client.setex(key, ttl, value);
  };

  /**
   * Sets or updates a  timeout on a key
   *
   * @param {String} key
   * @param {Integer} timestamp time where the key should be deleted
   * @returns {Promise}
   */
  this.expireAt = function (key, timestamp) {
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
   * @returns {promise} promise resolving to an array of keys
   */
  this.searchKeys = function (pattern) {
    var
      deferred = q.defer(),
      keys = [],
      stream = this.client.scanStream({
        match: pattern
      });

    stream.on('data', resultKeys => {
      keys = keys.concat(resultKeys);
    });
    stream.on('end', () => {
      deferred.resolve(_.uniq(keys));
    });

    return deferred.promise;
  };

  /**
   * Returns all the known keys of this database
   *
   * @returns {promise} promise resolving to an array of keys
   */
  this.getAllKeys = function () {
    return this.searchKeys('*');
  };

  /**
   * Gets the value of an array of keys
   *
   * @param {array} key
   * @returns {Promise}
   */
  this.mget = function () {
    var
      args = Array.prototype.slice.call(arguments);

    if (args && args[0] && _.isArray(args[0])) {
      args = args[0];
    }

    if (args.length === 0) {
      return q([]);
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
