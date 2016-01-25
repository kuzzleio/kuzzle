var
  RequestObject = require('./core/models/requestObject'),
  q = require('q');

module.exports = function () {
  var
    deferred = q.defer(),
    requestObject = new RequestObject({controller: 'admin', action: 'deleteIndexes'});

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN !== '1' || !this.isServer) {
    deferred.resolve();
    return deferred.promise;
  }

  // @todo : manage internal index properly
  this.pluginsManager.trigger('data:deleteIndexes', requestObject);

  this.workerListener.add(requestObject)
    .then(() => {
      this.pluginsManager.trigger('cleanDb:done', 'Reset done: Kuzzle is now like a virgin, touched for the very first time !');

      deferred.resolve();
    })
    .catch(err => {
      this.pluginsManager.trigger('cleanDb:error', err);

      // We resolve the promise, because we don't want stop the start process just because reset didn't work.
      // (can fail if the database is pristine)
      deferred.resolve();
    });

  return deferred.promise;
};