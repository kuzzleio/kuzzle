var
  _ = require('lodash'),
  q = require('q'),
  Redis = require('ioredis'),
  InternalError = require('../api/core/errors/internalError');

module.exports = function (kuzzle, options) {
  this.kuzzleConfig = kuzzle.config;
  this._type = options.service;
  this.client = null;
  this.initialized = null;
  this.commands = [];

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

    if (this.kuzzleConfig.cache.databases.indexOf(this._type) === -1) {
      this.initialized.reject(new InternalError('Unknown database: ', this._type));
      return this.initialized.promise;
    }

    this.client = buildClient(this.kuzzleConfig.cache);

    this.client.on('ready', () => {
      this.client.select(this.kuzzleConfig.cache.databases.indexOf(this._type), error => {
        if (error) {
          return this.initialized.reject(error);
        }
        // do not flush publicCache
        if (this._type === 'memoryStorage') {
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
        var
          args = [this.client, command].concat(Array.prototype.slice.call(arguments));

        return q.ninvoke.apply(this, args);
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
    return this.smembers(key);
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
   * @param pattern
   * @returns {promise} promise resolving to an array of keys
   */
  this.searchKeys = function (pattern) {
    var
      deferred = q.defer(),
      cursor = 0,
      keys = [];

    var scan = function () {
      this.client.scan(cursor, 'MATCH', pattern, 'COUNT', '10', (error, result) => {
        if (error) {
          return deferred.reject(error);
        }

        cursor = result[0];

        if (result[1].length > 0) {
          keys.push.apply(keys, result[1]);
        }

        // This means that there is no more result left to retrieve
        if (cursor === '0') {
          // Redis SCAN command does not guarantee key unicity, due to the way SCAN works
          return deferred.resolve(_.uniq(keys));
        }

        return scan();
      });
    }.bind(this);

    scan();

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
};

function buildClient (config) {
  if (config.nodes) {
    return new Redis.Cluster(config.nodes, {enableReadyCheck: true});
  }

  return new Redis(config.node);
}
