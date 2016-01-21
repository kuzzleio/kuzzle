var
  RequestObject = require('./core/models/requestObject'),
  q = require('q');

module.exports = function () {

  var deferred = q.defer();

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN !== '1' || !this.isServer) {
    deferred.resolve();
    return deferred.promise;
  }

  this.services.list.writeEngine.deleteIndexes(new RequestObject({}))
    // @todo : manage internal index properly
    // create internal index
    .then(this.services.list.writeEngine.createIndex(new RequestObject({index: this.config.internalIndex})))
    .then(function () {
      this.pluginsManager.trigger('cleanDb:done', 'Reset done: Kuzzle is now like a virgin, touched for the very first time !');

      deferred.resolve();
    }.bind(this))
    .catch(function () {
      this.pluginsManager.trigger('cleanDb:error', 'Oops... something really bad happened during reset...');

      // We resolve the promise, because we don't want stop the start process just because reset didn't work.
      // (can fail if the database is pristine)
      deferred.resolve();
    }.bind(this));

  return deferred.promise;
};