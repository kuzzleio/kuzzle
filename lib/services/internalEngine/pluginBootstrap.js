const Promise = require('bluebird');
let _kuzzle;

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {InternalEngine} engine
 * @constructor
 */
function PluginInternalEngineBootstrap (kuzzle, engine) {
  _kuzzle = kuzzle;
  this.engine = engine;
}

/**
 * Bootstraps Plugin storage engine
 * Creates the internal index and collections if needed
 *
 * @returns {Promise.<T>}
 */
PluginInternalEngineBootstrap.prototype.all = function internalEngineBootstrapAll (collections) {
  return this.engine.createInternalIndex()
    .then(() => this.createCollections(collections))
    .then(() => this.engine.refresh())
    .then(() => Promise.resolve(_kuzzle.indexCache.add(this.engine.index)))
    .catch(error => {
      // plugin manager is initializing, cannot use the logger
      console.error(error, error.stack);  // eslint-disable-line no-console
      throw error;
    });
};

PluginInternalEngineBootstrap.prototype.createCollection = function internalEngineBootstrapCreateCollection (collection, collectionMapping) {
  return this.engine.updateMapping(collection, collectionMapping);
};

PluginInternalEngineBootstrap.prototype.createCollections = function internalEngineBootstrapCreateCollections (collections) {
  const promises = [Promise.resolve()];

  Object.keys(collections).forEach(collection => {
    promises.push(this.createCollection(collection, collections[collection]));
  });

  return Promise.all(promises);
};

module.exports = PluginInternalEngineBootstrap;
