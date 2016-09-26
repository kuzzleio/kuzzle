var
  Promise = require('bluebird'),
  _kuzzle;

/**
 * Clear Redis Caches
 *
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise}
 */
function clearCache (request) {
  var
    cacheEngine,
    database = request.data.body.database || 'internalCache';

  cacheEngine = _kuzzle.services.list[database];
  if (cacheEngine === undefined) {
    return Promise.reject('Database '.concat(database, ' not found!'));
  }
  return new Promise((resolve, reject) => cacheEngine.flushdb(err => err ? reject(err) : resolve()));
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return clearCache;
};
