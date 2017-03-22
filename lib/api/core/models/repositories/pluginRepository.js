const
  _ = require('lodash'),
  Repository = require('./repository');

class PluginRepository extends Repository {
  constructor (kuzzle, pluginName, collection) {
    super(kuzzle, pluginName);

    this.collection = collection;
    this.ObjectConstructor = Object;
  }

  init (options) {
    if (options && options instanceof Object && !Array.isArray(options)) {
      if (options.cacheEngine !== null) {
        options.cacheEngine = null;
      }

      if (options.ObjectConstructor) {
        this.ObjectConstructor = options.ObjectConstructor;
      }
    }

    super.init(options);
  }

  /**
   * Serializes the object before being persisted to database.
   *
   * @param {object} data - The object to serialize
   * @returns {object}
   */
  serializeToDatabase (data) {
    // avoid the data var mutation
    const result = _.assignIn({}, data);

    delete result._id;

    return result;
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  create (object) {
    return this.persistToDatabase(object, {method: 'create'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  createOrReplace (object) {
    return this.persistToDatabase(object, {method: 'createOrReplace'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  replace (object) {
    return this.persistToDatabase(object, {method: 'replace'});
  }

  /**
   * @param {object} object
   * @returns {Promise}
   */
  update (object) {
    return this.persistToDatabase(object, {method: 'update'});
  }

  /**
   * @param {string} documentId
   * @returns {Promise}
   */
  load (documentId) {
    return super.load(documentId);
  }

  /**
   * @param {string} documentId
   * @returns {Promise}
   */
  delete (documentId) {
    return super.delete(documentId);
  }
}

module.exports = PluginRepository;