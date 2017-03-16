const
  Repository = require('./repository'),
  Data = require('../plugin/data');

class PluginRepository extends Repository {
  constructor (kuzzle, pluginName) {
    super(kuzzle, pluginName);

    // We set the collection to null on purpose to force plugins
    // to specify the collection in each calls
    this.collection = null;
    this.ObjectConstructor = Data;
  }

  init (options) {
    if (options instanceof Object && !Array.isArray(options) && options.cacheEngine !== null) {
      options.cacheEngine = null;
    }

    super.init(options);
  }

  /**
   * Serializes the object before being persisted to database.
   *
   * @param {object} object - The object to serialize
   * @returns {object}
   */
  serializeToDatabase (object) {
    return this.serializeToCache(object);
  }

  /**
   * @param {object} object
   * @param {string} collection
   * @returns {Promise}
   */
  create (object, collection) {
    return this.persistToDatabase(object, {method: 'create'}, collection);
  }

  /**
   * @param {object} object
   * @param {string} collection
   * @returns {Promise}
   */
  createOrReplace (object, collection) {
    return this.persistToDatabase(object, {method: 'createOrReplace'}, collection);
  }

  /**
   * @param {object} object
   * @param {string} collection
   * @returns {Promise}
   */
  replace (object, collection) {
    return this.persistToDatabase(object, {method: 'replace'}, collection);
  }

  /**
   * @param {object} object
   * @param {string} collection
   * @returns {Promise}
   */
  update (object, collection) {
    return this.persistToDatabase(object, {method: 'update'}, collection);
  }
}

module.exports = PluginRepository;