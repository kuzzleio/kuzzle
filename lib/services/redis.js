var
  q = require('q'),
  redis = require('redis');

module.exports = function (kuzzle, options) {
  this.kuzzleConfig = kuzzle.config;
  this.type = options.service;
  this.client = null;

  /**
   * Initialize the redis client
   *
   * @returns {Object} client
   */
  this.init = function() {
    if (this.client) {
      return this;
    }

    this.client = redis.createClient(this.kuzzleConfig[this.type].port, this.kuzzleConfig[this.type].host, {});

    return this;
  };

  /**
   * Add one or multiple value to a key
   *
   * @param {String} key
   * @param {String|Array} values
   * @return {Promise} Number of values created
   */
  this.add = function(key, values) {
    var
      addSet = [key];

    if (!values) {
      return q.when(0);
    }

    if (typeof values === 'string') {
      addSet.push(values);
    } else {
      if (values.length === 0) {
        return q.when(0);
      }
      addSet = addSet.concat(values);
    }

    return q.ninvoke(this.client, 'sadd', addSet);
  };

  /**
   * Remove one or multiple value(s) from a key
   * If the "values" argument is empty, removes the key completely
   *
   *  @param {String} key
   *  @param {String|Array} values
   *  @return {Promise} Number of values deleted
   */
  this.remove = function(key, values) {
    if (values && values.length > 0) {
      return q.ninvoke(this.client, 'srem', [key, values]);
    }

    return q.ninvoke(this.client, 'del', key);
  };

  /**
   * Returns all values corresponding to a key
   *
   * @param {String} key
   * @return {Promise} Array of retrieved value(s)
   */
  this.search = function(key) {
    return q.ninvoke(this.client, 'smembers', key);
  };

  /**
   * @param {String} key
   * @param {String} value
   * @return {Promise} String "OK" on success
   */
  this.set = function (key, value) {
    return q.ninvoke(this.client, 'set', [key, value]);
  };

  /**
   * @param {String} key
   * @returns {Promise} Serialized value matching the key
   */
  this.get = function (key) {
    return q.ninvoke(this.client, 'get', key);
  };
};
