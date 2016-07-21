var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  Promise = require('bluebird'),
  _kuzzle;

/**
 * Removes all indexes from the database
 *
 * @param {Kuzzle} kuzzle
 * @returns {Promise}
 */
function cleanDb () {
  // has a reset been asked on a worker?
  if (!_kuzzle.isServer) {
    return Promise.reject(new BadRequestError('Only a Kuzzle Server can reset the database'));
  }

  return _kuzzle.internalEngine.deleteIndex('_all')
    .then(response => {
      _kuzzle.indexCache.reset();
      
      return response;
    });
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return cleanDb;
};
