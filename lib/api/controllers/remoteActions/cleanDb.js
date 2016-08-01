var
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
      _kuzzle.indexCache.remove(_kuzzle.internalEngine.index);
      
      return response;
    });
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return cleanDb;
};
