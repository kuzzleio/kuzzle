var
  q = require('q'),
  redis = require('redis');

module.exports = {
  kuzzleConfig: {},
  client: null,

  /**
   * Initialize the redis client
   *
   * @param {Object} kuzzleConfig kuzzle configuration
   * @param {String} type
   * @returns {Object} client
   */
  init: function(kuzzleConfig, type) {
    var configuredHost;

    if (this.client) {
      return this.client;
    }

    this.kuzzleConfig = kuzzleConfig;
    configuredHost = this.kuzzleConfig[type].host.split(':');

    this.client = redis.createClient(configuredHost[1], configuredHost[0], {});

    return this.client;
  },

  /**
   * Add one or multiple value to a key
   *
   * @param {String} key
   * @param {String|Array} values
   * @return {Promise} Number of values created
   */
  add: function(key, values) {
    var
      addSet = [key];

    if (!values) {
      return q.when(0);
    }

    if ( typeof values === 'string') {
      addSet.push(values);
    } else {
      if ( values.length === 0 ) {
        return q.when(0);
      }
      addSet = addSet.concat(values);
    }

    return q.ninvoke(this.client, 'sadd', addSet);
  },

  /**
   * Remove one or multiple value(s) from a key
   * If the "values" argument is empty, removes the key completely
   *
   *  @param {String} key
   *  @param {String|Array} values
   *  @return {Promise} Number of values deleted
   */
  remove: function(key, values) {
    if (values && values.length > 0) {
      return q.ninvoke(this.client, 'srem', [key, values]);
    } else {
      return q.ninvoke(this.client, 'del', key);
    }
  },

  /**
   * Returns all values corresponding to a key
   *
   * @param {String} key
   * @return {Promise} Array of retrieved value(s)
   */
  search: function(key) {
    return q.ninvoke(this.client, 'smembers', key);
  }
};
