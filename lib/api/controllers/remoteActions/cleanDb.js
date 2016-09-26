var
  Promise = require('bluebird'),
  _kuzzle;

/**
 * Removes all indexes from the database
 *
 * @param {Kuzzle} kuzzle
 * @returns {Promise}
 */
function cleanDb () {
  return _kuzzle.internalEngine.deleteIndex(_kuzzle.internalEngine.index)
    .then(response => {
      return Promise.all(_kuzzle.config.services.cache.aliases.map(id => {
        return new Promise((resolve, reject) => {
          _kuzzle.services.list[id].flushdb(err => err ? reject(err) : resolve());
        });
      })).then(() => {
        return response;
      });
    })
    .then(response => {
      _kuzzle.indexCache.remove(_kuzzle.internalEngine.index);

      return response;
    });
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return cleanDb;
};
