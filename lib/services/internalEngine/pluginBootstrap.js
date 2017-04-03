const Promise = require('bluebird');

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {InternalEngine} engine
 * @constructor
 */
class PluginInternalEngineBootstrap {
  constructor(kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.db = engine;
  }

  /**
   * Bootstraps Plugin storage engine
   * Creates the internal index and collections if needed
   *
   * @returns {Promise.<T>}
   */
  all (collections) {
    return this.db.createInternalIndex()
      .then(() => this.createCollections(collections))
      .then(() => this.db.refresh())
      .then(() => Promise.resolve(this.kuzzle.indexCache.add(this.db.index)))
      .catch(error => {
        // plugin manager is initializing, cannot use the logger
        console.error(error, error.stack);  // eslint-disable-line no-console
        throw error;
      });
  }

  createCollection (collection, collectionMapping) {
    return this.db.updateMapping(collection, collectionMapping);
  }

  createCollections (collections) {
    const promises = [Promise.resolve()];

    Object.keys(collections).forEach(collection => {
      promises.push(this.createCollection(collection, collections[collection]));
    });

    return Promise.all(promises);
  }
}

module.exports = PluginInternalEngineBootstrap;
