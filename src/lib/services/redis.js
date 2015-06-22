var
  q = require("q"),
  redis = require("redis");

module.exports = {
  kuzzle: null,
  client: null,

  /**
   * Initialize the redis cache client
   *
   * @param {Kuzzle} kuzzle
   * @returns {Object} client
   */
  init: function(kuzzle) {
    var configuredHost;

    if (this.client) {
      return this.client;
    }

    this.kuzzle = kuzzle;
    configuredHost = this.kuzzle.config.cache.host.split(':');

    this.client = redis.createClient(configuredHost[1], configuredHost[0], {});

    return this.client;
  },

  /**
   * Link an object ID to one or multiple rooms
   *
   * @param {String} Id of the object(s) to add to a room
   * @param {String|Array} Id of the rooms
   * @return {Promise} Number of links created
   */
  add: function(object, rooms) {
    var
      addSet = [object];

    if (!rooms) {
      return q.when(0);
    }

    if ( typeof rooms === 'string') {
      addSet.push(rooms);
    } else {
      addSet = addSet.concat(rooms);
    }

    return q.ninvoke(this.client, "sadd", addSet);
  },

  /**
   * Remove an object from one or multiple rooms.
   * If the room argument is empty, removes all links to the object.
   *
   *  @param {String} Id of the object to remove
   *  @param {String|Array} Room(s) from which the object is to be removed
   *  @return {Promise} Number of links deleted
   */
  remove: function(object, rooms) {
    if (rooms) {
      return q.ninvoke(this.client, "srem", [object, rooms]);
    } else {
      return q.ninvoke(this.client, "del", object);
    }
  },

  /**
   * Returns all rooms listening to a given object
   *
   * @param {String} Id of the searched object
   * @return {Promise} Retrieven link(s)
   */
  search: function(object) {
    return q.ninvoke(this.client, "smembers", object);
  }
};
